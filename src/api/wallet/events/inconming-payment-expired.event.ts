import { Injectable } from '@nestjs/common';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { EventWebHook } from '../dto/event-webhook';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { WalletService } from '../service/wallet.service';

export class IncomingPaymentExpiredEvent implements EventWebHook {
	constructor(private readonly walletService: WalletService) {}
	async trigger(eventWebHookDTO: EventWebHookDTO, wallet): Promise<void> {
		const docClient = new DocumentClient();
		const credits =
			(wallet?.pendingDebits || 0) -
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

		const userIncoming = await this.walletService.getUserIncomingPaymentById(
			eventWebHookDTO?.data?.id
		);

		const paramsStatus = {
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
		try {
			const result = await docClient.update(params).promise();
			await docClient.update(paramsStatus).promise();
			return convertToCamelCase(result);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error on trigger incoming payment expired: ${error.message}`
			);
		}
	}
}
