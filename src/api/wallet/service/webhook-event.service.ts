import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { hookEventMap } from 'src/utils/hookEventMap';
import { EventWebHook } from '../dto/event-webhook';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { WalletService } from './wallet.service';
@Injectable()
export class WebHookEventService {
	constructor(private readonly walletService: WalletService) {}

	async executeEvent(eventWebHookDTO: EventWebHookDTO) {
		try {
			const event = hookEventMap[eventWebHookDTO.type](eventWebHookDTO.type);

			if (event) {
				const wallet = await this.walletService.getWalletByRafikyId(
					eventWebHookDTO.data.walletAddressId
				);

				await event.trigger(eventWebHookDTO, wallet);
			}
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error triggering event: ${error.message}`);
		}
	}
}
