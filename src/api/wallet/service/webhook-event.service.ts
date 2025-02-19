import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import * as Sentry from '@sentry/nestjs';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { hookEventMap } from 'src/utils/hookEventMap';
import { EventWebHook } from '../dto/event-webhook';
import { EventWebHookDTO } from '../dto/event-hook.dto';
import { WalletService } from './wallet.service';
import { UserWsGateway } from './websocket-users';

@Injectable()
export class WebHookEventService {
	constructor(
		private readonly walletService: WalletService,
		private readonly userWsGateway: UserWsGateway
	) {}

	async executeEvent(eventWebHookDTO: EventWebHookDTO) {
		try {
			const event = hookEventMap[eventWebHookDTO.type];

			if (event) {
				const wallet = await this.walletService.getWalletByRafikyId(
					eventWebHookDTO.data.walletAddressId
				);
				const eventAction = hookEventMap[eventWebHookDTO.type](
					this.walletService,
					this.userWsGateway
				);

				await eventAction.trigger(eventWebHookDTO, wallet);
			}

			return { message: 'Evento ejecutado correctamente' };
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				`Error triggering event: ${error.message}`,
				HttpStatus.NOT_FOUND
			);
		}
	}
}
