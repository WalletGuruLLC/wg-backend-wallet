import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { hookEventMap } from 'src/utils/hookEventMap';
import { EventWebHook } from '../dto/event-webhook';
import { EventWebHookDTO } from '../dto/event-hook.dto';
@Injectable()
export class WebHookEventService {
	async getWalletByRafikyId(rafikiId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Wallets',
			IndexName: 'RafikyIdIndex',
			KeyConditionExpression: `RafikyId = :rafikyId`,
			ExpressionAttributeValues: {
				':rafikyId': rafikiId,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching wallet: ${error.message}`);
		}
	}

	async executeEvent(eventWebHookDTO: EventWebHookDTO) {
		try {
			const event: EventWebHook = hookEventMap[eventWebHookDTO.type];

			const wallet = await this.getWalletByRafikyId(
				eventWebHookDTO.data.walletAddressId
			);

			if (!event) {
				throw new HttpException(
					{
						statusCode: HttpStatus.BAD_REQUEST,
						customCode: 'WGE0183',
					},
					HttpStatus.BAD_REQUEST
				);
			}
			await event.trigger(eventWebHookDTO, wallet);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching wallet: ${error.message}`);
		}
	}
}
