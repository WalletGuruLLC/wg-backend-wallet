import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Get,
	Res,
	Req,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

import * as Sentry from '@sentry/nestjs';

import { WebHookEventService } from '../service/webhook-event.service';
import { EventWebHookDTO } from '../dto/event-hook.dto';

@ApiTags('webhook')
@Controller('api/v1/webhook')
export class WebHookController {
	constructor(private readonly webHookEventService: WebHookEventService) {}

	@Post()
	@ApiOperation({ summary: 'Recieve event from rafiki hook' })
	@ApiResponse({ status: 201, description: 'Event recived successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiBody({
		type: EventWebHookDTO,
		description: 'Event Data',
	})
	async recieveEvent(@Body() input: EventWebHookDTO, @Req() req, @Res() res) {
		try {
			const eventResult = await this.webHookEventService.executeEvent(input);
			return res.status(200).send({
				data: eventResult,
				customCode: 'WGE0182',
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0183',
			});
		}
	}
}
