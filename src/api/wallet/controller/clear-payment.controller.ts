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
	Query,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiBody,
	ApiOkResponse,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import axios from 'axios';
import { ConfirmClearPayment } from '../dto/confirm-clear-payment.';

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

	@Post('/confirm')
	@ApiOperation({ summary: 'Confirm a clear payment' })
	@ApiResponse({
		status: 200,
		description: 'Clear Payment Has Been Confirmed',
	})
	@ApiResponse({
		status: 400,
		description: 'Error Confirming Clear Payment ',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async confirm(
		@Body()
		confirmClearPayment: ConfirmClearPayment,
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

			const clearPayment = await this.walletService.getProviderInfoRevenueById(
				confirmClearPayment.clearPaymentId
			);

			if (!clearPayment) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0163',
				});
			}

			if (!confirmClearPayment.referenceNumber) {
				return res.status(HttpStatus.BAD_REQUEST).send({
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0229',
				});
			}

			if (!confirmClearPayment.observations) {
				return res.status(HttpStatus.BAD_REQUEST).send({
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0229',
				});
			}

			const confirmedClearPayment =
				await this.walletService.confirmClearPayment(
					confirmClearPayment,
					clearPayment
				);

			if (confirmedClearPayment?.statusCode) {
				return res.status(confirmedClearPayment?.statusCode).send({
					statusCode: confirmedClearPayment?.statusCode,
					customCode: confirmedClearPayment?.customCode,
				});
			}
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0235',
				data: { confirmedClearPayment },
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
						customCode: 'WGE0236',
						message: error?.message,
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
				data: { ...providerRevenues },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(500).send({
				customCode: 'WGE0163',
			});
		}
	}

	@Get('list/payments')
	@ApiQuery({ name: 'month', required: false, type: Number })
	@ApiQuery({ name: 'providerId', required: false, type: String })
	@ApiQuery({ name: 'status', required: false, type: Boolean })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiOperation({ summary: 'List all clear payments' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Clear payments successfully retrieved.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async listClearPayments(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('month') month?: number,
		@Query('year') year?: number,
		@Query('providerId') providerId?: string,
		@Query('status') status?: string,
		@Query('page') page?: string,
		@Query('items') items?: string
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

		try {
			let provider;
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;
			const userTypeInfo = userInfo?.data?.type;

			const serviceProviderId =
				userTypeInfo === 'PROVIDER'
					? userInfo?.data?.serviceProviderId
					: providerId;

			if (serviceProviderId) {
				provider = await this.walletService.getWalletByProviderId(
					serviceProviderId
				);

				if (provider?.statusCode) {
					return res.status(HttpStatus.NOT_FOUND).send({
						statusCode: HttpStatus.NOT_FOUND,
						customCode: 'WGE0040',
					});
				}
			}

			const parsedStatus = status === undefined ? undefined : status === 'true';

			const filters = {
				month,
				year,
				serviceProviderId: serviceProviderId,
				state: parsedStatus,
				page,
				items,
			};
			const clearPayments = await this.walletService.listClearPayments(
				filters,
				provider
			);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0161',
				data: { ...clearPayments },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0163',
				message: error?.message,
			});
		}
	}
}
