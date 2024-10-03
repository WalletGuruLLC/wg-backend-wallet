import { Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';

export class IncomingPaymentExpiredEvent implements EventWebHook {
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const credits =
			wallet.pendingDebits -
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
			const result = await docClient.update(params).promise();
			return convertToCamelCase(result);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger incoming payment expired: ${error.message}`
			);
		}
	}
}
