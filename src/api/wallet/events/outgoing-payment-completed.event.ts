import { Injectable } from '@nestjs/common';
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

export class OutGoingPaymentCompletedEvent implements EventWebHook {
	private dbTransactions: Model<Transaction>;

	constructor(
		private readonly walletService: WalletService,
		private readonly userWsGateway: UserWsGateway
	) {
		this.dbTransactions = dynamoose.model<Transaction>(
			'Transactions',
			TransactionsSchema
		);
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
			};
			const transactionValue = await this.dbTransactions.create(transaction);

			this.userWsGateway.sendTransaction(
				userWallet?.userId || userWallet?.providerId,
				transactionValue
			);

			const sender = await docClient.update(params).promise();
			const receiver = await docClient.update(recieverParams).promise();

			const senderBalance = {
				pendingCredit: sender.Attributes?.PendingCredits,
				pendingDebit: sender.Attributes?.PendingDebits,
				postedCredit: sender.Attributes?.PostedCredits,
				postedDebit: sender.Attributes?.PostedDebits,
			};

			this.userWsGateway.sendBalance(wallet.userId, senderBalance);

			const receiverBalance = {
				pendingCredit: receiver.Attributes?.PendingCredits,
				pendingDebit: receiver.Attributes?.PendingDebits,
				postedCredit: receiver.Attributes?.PostedCredits,
				postedDebit: receiver.Attributes?.PostedDebits,
			};

			this.userWsGateway.sendBalance(
				receiver.Attributes?.UserId,
				receiverBalance
			);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger outgoing payment completed: ${error.message}`
			);
		}
	}
}
