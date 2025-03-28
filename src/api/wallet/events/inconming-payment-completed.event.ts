import { HttpException, Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';
import { HttpStatus } from 'src/utils/constants';

export class IncomingPaymentCompletedEvent implements EventWebHook {
	constructor(private readonly walletService: WalletService) {}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const transaction =
			await this.walletService.getTransactionByIncomingPaymentId(
				eventWebHookDTO.data.id
			);
		const transactionParams = {
			Key: {
				Id: transaction.id,
			},
			TableName: 'Transactions',
			ExpressionAttributeNames: {
				'#state': 'State',
			},
			UpdateExpression: 'SET #state = :state',
			ExpressionAttributeValues: {
				':state': 'COMPLETED',
			},
			ReturnValues: 'ALL_NEW',
		};

		try {
			if (eventWebHookDTO?.data?.metadata?.type === 'PROVIDER') {
				const userIncoming =
					await this.walletService.getUserIncomingPaymentById(
						eventWebHookDTO.data.id
					);

				const params = {
					Key: {
						Id: userIncoming?.id,
					},
					TableName: 'UserIncoming',
					UpdateExpression: 'SET Status = :status',
					ExpressionAttributeValues: {
						':status': false,
					},
					ReturnValues: 'ALL_NEW',
				};
				await docClient.update(params).promise();
			}
			await docClient.update(transactionParams).promise();
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				`Error on trigger incoming payment completed: ${error.message}`,
				HttpStatus.NOT_FOUND
			);
		}
	}
}
