import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';
import { Model } from 'dynamoose/dist/Model';
import { Transaction } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';
import * as dynamoose from 'dynamoose';
import { UserWsGateway } from '../service/websocket-users';
import axios from 'axios';

export class IncomingPaymentCreatedEvent implements EventWebHook {
	private dbTransactions: Model<Transaction>;
	private readonly API_SECRET_SERVICES: string;
	private readonly WS_URL: string;

	constructor(
		private readonly walletService: WalletService,
		private readonly userWsGateway: UserWsGateway
	) {
		this.dbTransactions = dynamoose.model<Transaction>(
			'Transactions',
			TransactionsSchema
		);
		this.API_SECRET_SERVICES = process.env.API_SECRET_SERVICES;
		this.WS_URL = process.env.WS_URL;
	}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const userId = eventWebHookDTO?.data?.metadata?.wgUser;
		const providerId = eventWebHookDTO?.data?.metadata?.serviceProviderId;

		const credits =
			(wallet.pendingCredits || 0) +
			parseInt(eventWebHookDTO.data.incomingAmount.value);

		const params = {
			Key: {
				Id: wallet.id,
			},
			TableName: 'Wallets',
			UpdateExpression: 'SET PendingCredits = :pendingCredits',
			ExpressionAttributeValues: {
				':pendingCredits': credits,
			},
			ReturnValues: 'ALL_NEW',
		};

		try {
			const userWallet = await this.walletService.getWalletByUser(userId);
			if (eventWebHookDTO?.data?.metadata?.type === 'PROVIDER') {
				const debits =
					(userWallet?.pendingDebits || 0) +
					parseInt(eventWebHookDTO.data.incomingAmount.value);
				const userWalletParams = {
					Key: {
						Id: userWallet?.id,
					},
					TableName: 'Wallets',
					UpdateExpression: 'SET PendingDebits = :pendingDebits',
					ExpressionAttributeValues: {
						':pendingDebits': debits,
					},
					ReturnValues: 'ALL_NEW',
				};
				const sender = await docClient.update(userWalletParams).promise();

				const balance = {
					pendingCredit: sender.Attributes?.PendingCredits,
					pendingDebit: sender.Attributes?.PendingDebits,
					postedCredit: sender.Attributes?.PostedCredits,
					postedDebit: sender.Attributes?.PostedDebits,
				};

				// this.userWsGateway.sendBalance(userWallet?.userId, balance); replace send ws to send notification to service ws
				balance['userId'] = userWallet?.userId;
				const userInfo = await axios.post(
					this.WS_URL + '/api/v1/wallets-rafiki/ws',
					{
						balance: balance,
					},
					{
						headers: {
							Authorization: this.API_SECRET_SERVICES,
						},
					}
				);
				console.log('wallets-rafiki/ws', userInfo.data);
			}

			const recieverWallet = await this.walletService.getWalletByRafikyId(
				eventWebHookDTO?.data?.walletAddressId
			);

			const senderWalletValue =
				await this.walletService.getWalletAddressByProviderId(providerId);

			const transaction = {
				Type: 'IncomingPayment',
				IncomingPaymentId: eventWebHookDTO.data?.id,
				WalletAddressId: eventWebHookDTO?.data?.walletAddressId,
				ReceiverUrl: recieverWallet?.walletAddress,
				SenderUrl:
					eventWebHookDTO?.data?.metadata?.type === 'REVENUE'
						? senderWalletValue?.walletAddress
						: userWallet?.walletAddress,
				State: 'PENDING',
				Metadata: eventWebHookDTO.data?.metadata,
				IncomingAmount: {
					_Typename: 'Amount',
					value: eventWebHookDTO.data?.incomingAmount?.value,
					assetCode: eventWebHookDTO.data?.incomingAmount?.assetCode,
					assetScale: eventWebHookDTO.data?.incomingAmount?.assetScale,
				},
				Description: '',
				Pay: false,
			};

			const transactionValue = await this.dbTransactions.create(transaction);

			const senderWallet = await this.walletService.getWalletByAddress(
				transaction?.SenderUrl
			);
			const receiverWallet = await this.walletService.getWalletByAddress(
				transaction?.ReceiverUrl
			);

			let senderName = 'Unknown';
			let receiverName = 'Unknown';

			if (senderWallet?.userId) {
				const senderWalletInfo = await this.walletService.getUserInfoById(
					senderWallet?.userId
				);
				if (senderWalletInfo) {
					senderName = `${senderWalletInfo?.firstName} ${senderWalletInfo?.lastName}`;
				}
			}

			if (receiverWallet?.userId) {
				const receiverWalletInfo = await this.walletService.getUserInfoById(
					receiverWallet?.userId
				);
				if (receiverWalletInfo) {
					receiverName = `${receiverWalletInfo?.firstName} ${receiverWalletInfo?.lastName}`;
				}
			}

			if (senderName === 'Unknown' && senderWallet?.providerId) {
				const senderProviderInfo = await this.walletService.getProviderById(
					senderWallet?.providerId
				);
				if (senderProviderInfo) {
					senderName = senderProviderInfo?.name;
				}
			}

			if (receiverName === 'Unknown' && receiverWallet?.providerId) {
				const receiverProviderInfo = await this.walletService.getProviderById(
					receiverWallet?.providerId
				);
				if (receiverProviderInfo) {
					receiverName = receiverProviderInfo?.name;
				}
			}

			const transactionFormated = {
				...transactionValue,
				senderName,
				receiverName,
			};

			// this.userWsGateway.sendTransaction(
			// 	recieverWallet?.userId || recieverWallet?.providerId,
			// 	transactionFormated
			// );
			transactionFormated['userId'] =
				recieverWallet?.userId || recieverWallet?.providerId;
			const transacctionWs = await axios.post(
				this.WS_URL + '/api/v1/wallets-rafiki/ws',
				{
					transacction: transactionFormated,
				},
				{
					headers: {
						Authorization: this.API_SECRET_SERVICES,
					},
				}
			);
			console.log('wallets-rafiki/ws', transacctionWs.data);

			const receiver = await docClient.update(params).promise();

			const balance = {
				pendingCredit: receiver.Attributes?.PendingCredits,
				pendingDebit: receiver.Attributes?.PendingDebits,
				postedCredit: receiver.Attributes?.PostedCredits,
				postedDebit: receiver.Attributes?.PostedDebits,
			};

			// this.userWsGateway.sendBalance(receiver.Attributes?.UserId, balance);
			balance['userId'] = receiver.Attributes?.UserId;
			const userInfo = await axios.post(
				this.WS_URL + '/api/v1/wallets-rafiki/ws',
				{
					balance: balance,
				},
				{
					headers: {
						Authorization: this.API_SECRET_SERVICES,
					},
				}
			);
			console.log('wallets-rafiki/ws', userInfo.data);

			return convertToCamelCase(receiver);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger incoming payment created: ${error.message}`
			);
		}
	}
}
