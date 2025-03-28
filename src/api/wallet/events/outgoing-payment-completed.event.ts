import { HttpException, Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { WalletService } from '../service/wallet.service';
import { Model } from 'dynamoose/dist/Model';
import { Transaction } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';
import * as dynamoose from 'dynamoose';
import { UserWsGateway } from '../service/websocket-users';
import axios from 'axios';
import { HttpStatus } from 'src/utils/constants';

export class OutGoingPaymentCompletedEvent implements EventWebHook {
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
		const recieverWallet = eventWebHookDTO?.data?.receiver.split('/');
		const incomingPaymentId = recieverWallet?.[4];
		const debits =
			(wallet?.postedDebits || 0) +
			parseInt(eventWebHookDTO.data.receiveAmount.value);

		const pendingDebits =
			(wallet?.pendingDebits || 0) -
			parseInt(eventWebHookDTO.data.receiveAmount.value);

		const params = {
			Key: {
				Id: wallet.id,
			},
			TableName: 'Wallets',
			UpdateExpression:
				'SET PostedDebits = :postedDebits, PendingDebits = :pendingDebits',
			ExpressionAttributeValues: {
				':postedDebits': debits,
				':pendingDebits': pendingDebits,
			},
			ReturnValues: 'ALL_NEW',
		};

		try {
			const incomingPayment = await this.walletService.getIncomingPayment(
				incomingPaymentId
			);
			const recieverWallet = await this.walletService.getWalletByRafikyId(
				incomingPayment?.walletAddressId
			);

			const recieverPostedCredits =
				(recieverWallet?.postedCredits || 0) +
				parseInt(eventWebHookDTO.data.receiveAmount.value);

			const recieverPendingCredits =
				(recieverWallet?.pendingCredits || 0) -
				parseInt(eventWebHookDTO.data.receiveAmount.value);

			const recieverParams = {
				Key: {
					Id: recieverWallet.id,
				},
				TableName: 'Wallets',
				UpdateExpression:
					'SET PostedCredits = :postedCredits, PendingCredits = :pendingCredits',
				ExpressionAttributeValues: {
					':postedCredits': recieverPostedCredits,
					':pendingCredits': recieverPendingCredits,
				},
				ReturnValues: 'ALL_NEW',
			};

			const userWallet = await this.walletService.getWalletByRafikyId(
				eventWebHookDTO?.data?.walletAddressId
			);

			const transaction = {
				Type: 'OutgoingPayment',
				OutgoingPaymentId: eventWebHookDTO.data?.id,
				ReceiverUrl: recieverWallet?.walletAddress,
				SenderUrl: userWallet?.walletAddress,
				State: eventWebHookDTO.data?.state,
				Metadata: eventWebHookDTO.data?.metadata,
				Receiver: eventWebHookDTO.data?.receiver,
				WalletAddressId: eventWebHookDTO?.data?.walletAddressId,
				ReceiveAmount: {
					_Typename: 'Amount',
					value: eventWebHookDTO.data?.receiveAmount?.value,
					assetCode: eventWebHookDTO.data?.receiveAmount?.assetCode,
					assetScale: eventWebHookDTO.data?.receiveAmount?.assetScale,
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
			// 	userWallet?.userId || userWallet?.providerId,
			// 	transactionFormated
			// );
			transactionFormated['userIdSend'] =
				userWallet?.userId || userWallet?.providerId;
			const transacctionWs = await axios.post(
				this.WS_URL + '/api/v1/wallets-rafiki/ws',
				{
					transaction: transactionFormated,
				},
				{
					headers: {
						Authorization: this.API_SECRET_SERVICES,
					},
				}
			);
			console.log('wallets-rafiki/ws', transacctionWs.data);

			const sender = await docClient.update(params).promise();
			const receiver = await docClient.update(recieverParams).promise();

			const senderBalance = {
				pendingCredit: sender.Attributes?.PendingCredits,
				pendingDebit: sender.Attributes?.PendingDebits,
				postedCredit: sender.Attributes?.PostedCredits,
				postedDebit: sender.Attributes?.PostedDebits,
			};

			// this.userWsGateway.sendBalance(wallet.userId, balance);
			senderBalance['userIdSend'] = wallet.userId;
			const notificationWs = await axios.post(
				this.WS_URL + '/api/v1/wallets-rafiki/ws',
				{
					balance: senderBalance,
				},
				{
					headers: {
						Authorization: this.API_SECRET_SERVICES,
					},
				}
			);
			console.log('wallets-rafiki/ws', notificationWs.data);

			const receiverBalance = {
				pendingCredit: receiver.Attributes?.PendingCredits,
				pendingDebit: receiver.Attributes?.PendingDebits,
				postedCredit: receiver.Attributes?.PostedCredits,
				postedDebit: receiver.Attributes?.PostedDebits,
			};

			// this.userWsGateway.sendBalance(
			// 	receiver.Attributes?.UserId,
			// 	receiverBalance
			// );

			receiverBalance['userIdSend'] = receiver.Attributes?.UserId;
			const notificationWs2 = await axios.post(
				this.WS_URL + '/api/v1/wallets-rafiki/ws',
				{
					balance: receiverBalance,
				},
				{
					headers: {
						Authorization: this.API_SECRET_SERVICES,
					},
				}
			);
			console.log('wallets-rafiki/ws', notificationWs2.data);
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				`Error on trigger outgoing payment completed: ${error.message}`,
				HttpStatus.NOT_FOUND
			);
		}
	}
}
