import { Injectable } from '@nestjs/common';
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

export class IncomingPaymentCreatedEvent implements EventWebHook {
	private dbTransactions: Model<Transaction>;
	constructor(private readonly walletService: WalletService) {
		this.dbTransactions = dynamoose.model<Transaction>(
			'Transactions',
			TransactionsSchema
		);
	}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const userId = eventWebHookDTO?.data?.metadata?.wgUser;
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
			if (userId) {
				const userWallet = await this.walletService.getWalletByUser(userId);
				const debits =
					(userWallet.pendingDebits || 0) +
					parseInt(eventWebHookDTO.data.incomingAmount.value);
				const userWalletParams = {
					Key: {
						Id: userWallet.id,
					},
					TableName: 'Wallets',
					UpdateExpression: 'SET PendingDebits = :pendingDebits',
					ExpressionAttributeValues: {
						':pendingDebits': debits,
					},
					ReturnValues: 'ALL_NEW',
				};
				await docClient.update(userWalletParams).promise();
			}

			if (eventWebHookDTO?.data?.metadata?.type === 'PROVIDER') {
				const recieverWallet = await this.walletService.getWalletByRafikyId(
					eventWebHookDTO?.data?.walletAddressId
				);

				const senderWallet = await this.walletService.getWalletUserById(userId);
				const transaction = {
					Type: 'IncomingPayment',
					IncomingPaymentId: eventWebHookDTO.data?.id,
					WalletAddressId: eventWebHookDTO?.data?.walletAddressId,
					ReceiverUrl: recieverWallet?.walletAddress,
					SenderUrl: senderWallet?.walletAddress,
					State: eventWebHookDTO.data?.state,
					Metadata: eventWebHookDTO.data?.metadata,
					Receiver: eventWebHookDTO.data?.receiver,
					IncomingAmount: {
						_Typename: 'Amount',
						value: eventWebHookDTO.data?.incomingAmount?.value,
						assetCode: eventWebHookDTO.data?.incomingAmount?.assetCode,
						assetScale: eventWebHookDTO.data?.incomingAmount?.assetScale,
					},
					Description: '',
				};
				await this.dbTransactions.create(transaction);
			}

			const result = await docClient.update(params).promise();

			return convertToCamelCase(result);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger incoming payment created: ${error.message}`
			);
		}
	}
}
