import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Headers,
	Res,
	Get,
	Param,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiBody,
	ApiOkResponse,
	ApiParam,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import axios from 'axios';
import { CreateClearPayment } from '../dto/clear-payment.dto';

@ApiTags('clear-payments')
@Controller('api/v1/clear-payments')
@ApiBearerAuth('JWT')
export class ClearPaymentController {
	private readonly AUTH_MICRO_URL: string;

	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {
		this.AUTH_MICRO_URL = process.env.AUTH_URL;
	}

	@Post()
	@ApiOperation({ summary: 'Create a new provider revenue' })
	@ApiBody({
		type: CreateClearPayment,
		description: 'Data required to create a new provider revenue',
	})
	@ApiResponse({
		status: 201,
		description: 'Provider Revenue Has Been Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Error Creating Provider Revenue',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async createProviderRevenue(
		@Body()
		createProviderRevenue: CreateClearPayment,
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		let token;
		try {
			token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
				},
				HttpStatus.UNAUTHORIZED
			);
		}
		token = token || '';
		try {
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{ headers: { Authorization: token } }
			);
			userInfo = userInfo.data;
			const userType = userInfo?.data?.type;

			if (userType !== 'PLATFORM') {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const providerWallet =
				await this.walletService.getWalletAddressByProviderId(
					createProviderRevenue.serviceProviderId
				);

			if (!providerWallet) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
			}

			const providerRevenue = await this.walletService.createProviderRevenue(
				createProviderRevenue,
				providerWallet
			);

			if (providerRevenue?.statusCode) {
				return res.status().send({
					statusCode: providerRevenue?.statusCode,
					customCode: providerRevenue?.customCode,
				});
			}
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.CREATED,
				customCode: 'WGE0227',
				data: { providerRevenue },
			});
		} catch (error) {
			Sentry.captureException(error);
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0229',
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Get('/:id')
	@ApiOperation({ summary: 'Retrieve provider revenues by Id' })
	@ApiParam({
		name: 'id',
		required: true,
		description: 'Provider revenue ID (Required)',
	})
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Provider revenues successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async findOneProviderRevenues(
		@Headers() headers: MapOfStringToList,
		@Res() res,
		@Param('id') id?: string
	) {
		let token;
		try {
			token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			const providerRevenues =
				await this.walletService.getProviderInfoRevenueById(id);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0161',
				providerRevenues,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(500).send({
				customCode: 'WGE0163',
			});
		}
	}
}
