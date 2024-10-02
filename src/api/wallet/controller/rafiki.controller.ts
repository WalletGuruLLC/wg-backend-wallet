import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Get,
	Headers,
	UsePipes,
	Res,
	Query,
	Req,
} from '@nestjs/common';

import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiBody,
	ApiQuery,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';
import { errorCodes, successCodes } from 'src/utils/constants';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { CreateServiceProviderWalletAddressDto } from '../dto/create-rafiki-service-provider-wallet-address.dto';
import { customValidationPipe } from '../../validation.pipe';
import { addApiSignatureHeader } from 'src/utils/helpers/signatureHelper';
import {
	CreateQuoteInputDTO,
	GeneralReceiverInputDTO,
	ReceiverInputDTO,
} from '../dto/payments-rafiki.dto';
import { isValidStringLength } from 'src/utils/helpers/isValidStringLength';

@ApiTags('wallet-rafiki')
@Controller('api/v1/wallets-rafiki')
@ApiBearerAuth('JWT')
export class RafikiWalletController {
	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {}

	@Post('address')
	@ApiOperation({ summary: 'Create a new wallet address' })
	@ApiBody({
		type: CreateRafikiWalletAddressDto,
		description: 'Data required to create a new wallet address',
	})
	@ApiResponse({
		status: 201,
		description: 'Wallet Address Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid Address Name or Address Name Already in Use',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async createWalletAddress(
		@Body() createRafikiWalletAddressDto: CreateRafikiWalletAddressDto,
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
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
		token = token || '';
		try {
			if (
				createRafikiWalletAddressDto?.addressName &&
				!isValidStringLength(createRafikiWalletAddressDto?.addressName)
			) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0155',
				});
			}

			if (createRafikiWalletAddressDto?.assetId) {
				const validateAssetId = await this.walletService.filterRafikiAssetById(
					createRafikiWalletAddressDto?.assetId
				);
				if (!validateAssetId?.id) {
					return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0156',
					});
				}
			}

			const wallet = await this.walletService.createWalletAddress(
				createRafikiWalletAddressDto,
				token
			);
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0080',
				data: { wallet },
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
						customCode: 'WGE0073',
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Post('service-provider-address')
	@ApiOperation({ summary: 'Create a new wallet address' })
	@ApiBody({
		type: CreateRafikiWalletAddressDto,
		description: 'Data required to create a new wallet address',
	})
	@ApiResponse({
		status: 201,
		description: 'Wallet Address Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid Address Name or Address Name Already in Use',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async createServiceProviderWalletAddress(
		@Body()
		createServiceProviderWalletAddressDto: CreateServiceProviderWalletAddressDto,
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
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}
		token = token || '';
		try {
			if (
				createServiceProviderWalletAddressDto?.addressName &&
				!isValidStringLength(createServiceProviderWalletAddressDto?.addressName)
			) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0155',
				});
			}

			if (createServiceProviderWalletAddressDto?.assetId) {
				const validateAssetId = await this.walletService.filterRafikiAssetById(
					createServiceProviderWalletAddressDto?.assetId
				);
				if (!validateAssetId?.id) {
					return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0156',
					});
				}
			}

			const wallet =
				await this.walletService.createServiceProviderWalletAddress(
					createServiceProviderWalletAddressDto
				);
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0080',
				data: { wallet },
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
						customCode: 'WGE0073',
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Get('assets')
	@ApiOperation({ summary: 'List all rafiki assets' })
	@ApiResponse({
		status: 200,
		description: successCodes.WGS0081?.description,
	})
	@ApiResponse({
		status: 500,
		description: errorCodes.WGE0083?.description,
	})
	async getRafikiAssets(@Headers() headers: MapOfStringToList) {
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
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const rafikiAssets = await this.walletService.getRafikiAssets();
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0081',
				customMessage: successCodes.WGS0081?.description,
				customMessageEs: successCodes.WGS0081?.descriptionEs,
				data: { rafikiAssets },
			};
		} catch (error) {
			Sentry.captureException(error);
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0083',
						customMessage: errorCodes.WGE0083?.description,
						customMessageEs: errorCodes.WGE0083?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Get('list-transactions')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiOperation({ summary: 'List all user transactions' })
	async listTransactions(
		@Headers() headers: MapOfStringToList,
		@Res() res,
		@Query('search') search?: string
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
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const transactions = await this.walletService.listTransactions(
				token,
				search
			);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: { transactions: transactions },
			});
		} catch (error) {
			Sentry.captureException(error);
			console.log('error', error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			});
		}
	}

	@Post('transaction')
	@ApiOperation({ summary: 'Create a transaction' })
	@ApiResponse({
		status: 201,
		description: 'transaction created successfully.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async createTransaction(
		@Body() input: ReceiverInputDTO,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			const inputReceiver = {
				metadata: input.metadata,
				incomingAmount: input.incomingAmount,
				walletAddressUrl: input.walletAddressUrl,
			};

			const receiver = await this.walletService.createReceiver(inputReceiver);
			const quoteInput = {
				walletAddressId: input?.walletAddressId,
				receiver: receiver?.createReceiver?.receiver?.id,
			};

			const quote = await this.walletService.createQuote(quoteInput);
			const inputOutgoing = {
				walletAddressId: input?.walletAddressId,
				quoteId: quote?.createQuote?.quote?.id,
			};
			const outgoingPayment = await this.walletService.createOutgoingPayment(
				inputOutgoing
			);
			return res.status(200).send({
				data: outgoingPayment,
				customCode: 'WGE0150',
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0151',
			});
		}
	}

	@Post('receiver')
	@ApiOperation({ summary: 'Create a receiver' })
	@ApiResponse({ status: 201, description: 'Receiver created successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async createReceiver(
		@Body() input: GeneralReceiverInputDTO,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			const receiver = await this.walletService.createReceiver(input);
			return res.status(200).send({
				data: receiver,
				customCode: 'WGE0152',
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0153',
			});
		}
	}

	@Post('quote')
	@ApiOperation({ summary: 'Create a quote' })
	@ApiResponse({ status: 201, description: 'Quote created successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async createQuote(
		@Body() input: CreateQuoteInputDTO,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			const quote = await this.walletService.createQuote(input);
			return res.status(200).send({
				data: quote,
				customCode: 'WGE0154',
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Get('exchange-rates')
	@ApiOperation({ summary: 'List all exchange rates' })
	@ApiResponse({
		status: 200,
		description: successCodes.WGS0081?.description,
	})
	@ApiResponse({
		status: 500,
		description: errorCodes.WGE0083?.description,
	})
	@ApiQuery({ name: 'search', required: false, type: String })
	async getExchangeRates(
		@Headers() headers: MapOfStringToList,
		@Res() res,
		@Query('base') base?: string
	) {
		try {
			const exchangeRates = await this.walletService.getExchangeRates(base);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0161',
				exchangeRates,
			});
		} catch (error) {
			console.log('error', error);
			Sentry.captureException(error);
			return res.status(500).send({
				customCode: 'WGE0163',
			});
		}
	}
}
