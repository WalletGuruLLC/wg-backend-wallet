import { Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';

export class IncomingPaymentCompletedEvent implements EventWebHook {
	constructor(private readonly walletService: WalletService) {}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();

		const userIncoming = await this.walletService.getUserIncomingPaymentById(
			eventWebHookDTO.data.id
		);

		const params = {
			Key: {
				Id: userIncoming.id,
			},
			TableName: 'UserIncoming',
			UpdateExpression: 'SET Status = :status',
			ExpressionAttributeValues: {
				':status': false,
			},
			ReturnValues: 'ALL_NEW',
		};

		try {
			const result = await docClient.update(params).promise();

			return convertToCamelCase(result);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger incoming payment completed: ${error.message}`
			);
		}
	}
}
