import { Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';

export class OutGoingPaymentCompletedEvent implements EventWebHook {
	constructor(private readonly walletService: WalletService) {}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const recieverWallet = eventWebHookDTO?.data?.receiver.split('/');
		const incomingPaymentId = recieverWallet?.[4];
		const debits =
			wallet?.postedDebits ||
			0 + parseInt(eventWebHookDTO.data.receivedAmount.value);

		const pendingDebits =
			wallet?.postedDebits ||
			0 - parseInt(eventWebHookDTO.data.receivedAmount.value);

		const walletPostedCredits =
			wallet?.postedCredits ||
			0 - parseInt(eventWebHookDTO.data.receivedAmount.value);
		const params = {
			Key: {
				Id: wallet.id,
			},
			TableName: 'Wallets',
			UpdateExpression:
				'SET PostedDebits = :postedDebits, PendingDebits = :pendingDebits, PostedCredits = :postedCredits',
			ExpressionAttributeValues: {
				':postedDebits': debits,
				':pendingDebits': pendingDebits,
				':postedCredits': walletPostedCredits,
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
				recieverWallet?.postedDebits ||
				0 + parseInt(eventWebHookDTO.data.receivedAmount.value);

			const recieverPendingCredits =
				recieverWallet?.pendingCredits ||
				0 - parseInt(eventWebHookDTO.data.receivedAmount.value);

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

			const result = await docClient.update(params).promise();
			await docClient.update(recieverParams).promise();
			return convertToCamelCase(result);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger outgoing payment completed: ${error.message}`
			);
		}
	}
}
