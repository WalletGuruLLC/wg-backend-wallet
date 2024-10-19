import { Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';
import { v4 as uuidv4 } from 'uuid';

export class OutGoingPaymentCreatedEvent implements EventWebHook {
	constructor(private readonly walletService: WalletService) {}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const recieverWallet = eventWebHookDTO?.data?.receiver.split('/');
		const incomingPaymentId = recieverWallet?.[4];
		const depositOutgoingPaymentInput = {
			outgoingPaymentId: eventWebHookDTO?.data?.id,
			idempotencyKey: uuidv4(),
		};	

		const debits =
			(wallet?.pendingDebits || 0) +
			parseInt(eventWebHookDTO.data.receiveAmount.value);

		const params = {
			Key: {
				Id: wallet.id,
			},
			TableName: 'Wallets',
			UpdateExpression: 'SET PendingDebits = :pendingDebits',
			ExpressionAttributeValues: {
				':pendingDebits': debits,
			},
			ReturnValues: 'ALL_NEW',
		};

		try {
			if (!eventWebHookDTO?.data?.metadata?.type) {
				await docClient.update(params).promise();
			}

			const incomingPayment = await this.walletService.getIncomingPayment(
				incomingPaymentId
			);
			if (incomingPayment?.metadata?.type !== 'PROVIDER') {
				setTimeout(async () => {
					await this.walletService.createDepositOutgoingMutationService(
						depositOutgoingPaymentInput
					);
				}, 500);
			}
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger outgoing payment created: ${error.message}`
			);
		}
	}
}
