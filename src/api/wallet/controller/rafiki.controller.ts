import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Get,
	Headers,
	Res,
	Query,
	Req,
	Param,
	Patch,
} from '@nestjs/common';
import * as dynamoose from 'dynamoose';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiBody,
	ApiQuery,
	ApiOkResponse,
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
	ActionOugoingPaymentDto,
	CreateQuoteInputDTO,
	DepositDTO,
	DepositOutgoingPaymentInputDTO,
	GeneralReceiverInputDTO,
	LinkInputDTO,
	ReceiverInputDTO,
} from '../dto/payments-rafiki.dto';
import { isValidStringLength } from 'src/utils/helpers/isValidStringLength';
import { v4 as uuidv4 } from 'uuid';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { CreatePaymentDTO } from '../dto/create-payment-rafiki.dto';
import { AuthGateway } from '../service/websocket';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { adjustValue } from 'src/utils/helpers/generalAdjustValue';
import { Model } from 'dynamoose/dist/Model';
import { Transaction } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';

@ApiTags('wallet-rafiki')
@Controller('api/v1/wallets-rafiki')
@ApiBearerAuth('JWT')
export class RafikiWalletController {
	private readonly AUTH_MICRO_URL: string;
	private dbTransactions: Model<Transaction>;

	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService,
		private readonly authGateway: AuthGateway,
		private configService: ConfigService
	) {
		this.AUTH_MICRO_URL = this.configService.get<string>('AUTH_URL');
		this.dbTransactions = dynamoose.model<Transaction>(
			'Transactions',
			TransactionsSchema
		);
	}

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
		@Headers() headers: MapOfStringToList,
		@Body() input: ReceiverInputDTO,
		@Req() req,
		@Res() res
	) {
		try {
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

			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;

			const userId = userInfo?.data?.id;

			const userWallet = await this.walletService.getWalletByRafikyId(
				input.walletAddressId
			);

			if (!userWallet) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
			}

			const userWalletByToken = convertToCamelCase(
				await this.walletService.getWalletByToken(token)
			);

			if (userWalletByToken?.walletDb?.userId !== userWallet?.userId) {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
				});
			}

			await addApiSignatureHeader(req, req.body);
			const inputReceiver = {
				metadata: {
					type: 'USER',
					wgUser: userId,
					description: '',
				},
				incomingAmount: {
					assetCode: userWalletByToken?.walletAsset?.code,
					assetScale: userWalletByToken?.walletAsset?.scale,
					value: adjustValue(
						input?.amount,
						userWalletByToken?.walletAsset?.scale
					),
				},
				walletAddressUrl: input.walletAddressUrl,
			};

			const receiver = await this.walletService.createReceiver(inputReceiver);
			const quoteInput = {
				walletAddressId: input?.walletAddressId,
				receiver: receiver?.createReceiver?.receiver?.id,
				receiveAmount: {
					assetCode: userWalletByToken?.walletAsset?.code,
					assetScale: userWalletByToken?.walletAsset?.scale,
					value: adjustValue(
						input?.amount,
						userWalletByToken?.walletAsset?.scale
					),
				},
			};

			setTimeout(async () => {
				const quote = await this.walletService.createQuote(quoteInput);
				const providerWalletId =
					quote?.createQuote?.quote?.receiver?.split('/');
				const incomingPaymentId = providerWalletId?.[4];
				await this.dbTransactions.create({
					Type: 'IncomingPayment',
					SenderUrl: userWallet?.walletAddress,
					ReceiverUrl: input?.walletAddressUrl,
					IncomingPaymentId: incomingPaymentId,
					WalletAddressId: quote?.createQuote?.quote?.receiver,
					State: 'PENDING',
					IncomingAmount: {
						_Typename: 'Amount',
						assetCode: userWalletByToken?.walletAsset?.code,
						assetScale: userWalletByToken?.walletAsset?.scale,
						value: adjustValue(
							input?.amount,
							userWalletByToken?.walletAsset?.scale
						)?.toString(),
					},
					Description: '',
				});

				const inputOutgoing = {
					walletAddressId: input?.walletAddressId,
					quoteId: quote?.createQuote?.quote?.id,
				};
				const outgoingPayment = await this.walletService.createOutgoingPayment(
					inputOutgoing
				);

				const transaction = {
					Type: 'OutgoingPayment',
					SenderUrl: userWallet?.walletAddress,
					ReceiverUrl: input?.walletAddressUrl,
					OutgoingPaymentId:
						outgoingPayment?.createOutgoingPayment?.payment?.id,
					WalletAddressId:
						outgoingPayment?.createOutgoingPayment?.payment?.walletAddressId,
					State: outgoingPayment?.createOutgoingPayment?.payment?.state,
					Metadata:
						outgoingPayment?.createOutgoingPayment?.payment?.metadata || {},
					Receiver: quote?.createQuote?.quote?.receiver,
					ReceiveAmount: {
						_Typename: 'Amount',
						value:
							outgoingPayment?.createOutgoingPayment?.payment?.receiveAmount
								?.value,
						assetCode:
							outgoingPayment?.createOutgoingPayment?.payment?.receiveAmount
								?.assetCode,
						assetScale:
							outgoingPayment?.createOutgoingPayment?.payment?.receiveAmount
								?.assetScale,
					},
					Description: '',
				};

				await this.dbTransactions.create(transaction);

				await this.walletService.sendMoneyMailConfirmation(
					inputOutgoing,
					outgoingPayment
				);

				this.authGateway.server.emit('hc', {
					message: '',
					statusCode: 'WGS0054',
					data: transaction,
				});

				return res.status(200).send({
					data: outgoingPayment,
					customCode: 'WGE0150',
				});
			}, 500);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0151',
			});
		}
	}

	@Post('service-provider-link')
	@ApiOperation({ summary: 'Create a transaction to link service provider' })
	@ApiResponse({
		status: 201,
		description: 'transaction created successfully.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async linkTransactionProvider(
		@Headers() headers: MapOfStringToList,
		@Body() input: LinkInputDTO,
		@Req() req,
		@Res() res
	) {
		try {
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

			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;

			const userId = userInfo?.data?.id;

			const userWallet = await this.walletService.getWalletByRafikyId(
				input.walletAddressId
			);

			if (!userWallet) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
			}

			const userWalletByToken = convertToCamelCase(
				await this.walletService.getWalletByToken(token)
			);

			if (userWalletByToken?.walletDb?.userId !== userWallet?.userId) {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
				});
			}

			const linkProvider = await this.walletService.updateListServiceProviders(
				userId,
				input?.walletAddressUrl,
				input?.sessionId
			);

			if (linkProvider?.customCode) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: linkProvider?.customCode,
				});
			}

			this.authGateway.server.emit('hc', {
				message: 'Account linked',
				statusCode: 'WGS0051',
				sessionId: input?.sessionId,
				wgUserId: userId,
			});

			return res.status(200).send({
				data: {
					linkedProvider: linkProvider,
				},
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

	@Get('linked-providers')
	@ApiOperation({ summary: 'Get linked service providers' })
	@ApiResponse({
		status: 201,
		description: 'Linked providrs retrieved successfully.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async getLinkedProvidersUserById(
		@Headers() headers: MapOfStringToList,
		@Req() req,
		@Res() res
	) {
		try {
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

			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;

			const userId = userInfo?.data?.id;

			const linkedProviders =
				await this.walletService.getLinkedProvidersUserById(userId);

			return res.status(200).send({
				data: {
					linkedProviders: linkedProviders,
				},
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

	// @Post('receiver')
	// @ApiOperation({ summary: 'Create a receiver' })
	// @ApiResponse({ status: 201, description: 'Receiver created successfully.' })
	// @ApiResponse({ status: 400, description: 'Bad Request' })
	// async createReceiver(
	// 	@Body() input: GeneralReceiverInputDTO,
	// 	@Req() req,
	// 	@Res() res
	// ) {
	// 	try {
	// 		await addApiSignatureHeader(req, req.body);
	// 		const receiver = await this.walletService.createReceiver(input);
	// 		return res.status(200).send({
	// 			data: receiver,
	// 			customCode: 'WGE0152',
	// 		});
	// 	} catch (error) {
	// 		Sentry.captureException(error);
	// 		return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
	// 			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
	// 			customCode: 'WGE0153',
	// 		});
	// 	}
	// }

	// @Post('quote')
	// @ApiOperation({ summary: 'Create a quote' })
	// @ApiResponse({ status: 201, description: 'Quote created successfully.' })
	// @ApiResponse({ status: 400, description: 'Bad Request' })
	// async createQuote(
	// 	@Body() input: CreateQuoteInputDTO,
	// 	@Req() req,
	// 	@Res() res
	// ) {
	// 	try {
	// 		await addApiSignatureHeader(req, req.body);
	// 		const quote = await this.walletService.createQuote(input);
	// 		return res.status(200).send({
	// 			data: quote,
	// 			customCode: 'WGE0154',
	// 		});
	// 	} catch (error) {
	// 		Sentry.captureException(error);
	// 		return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
	// 			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
	// 			customCode: 'WGE0155',
	// 		});
	// 	}
	// }

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
				...exchangeRates,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(500).send({
				customCode: 'WGE0163',
			});
		}
	}

	// @Post('deposit')
	// @ApiOperation({ summary: 'Create a deposit' })
	// @ApiResponse({ status: 201, description: 'Deposit created successfully.' })
	// @ApiResponse({ status: 400, description: 'Bad Request' })
	// async createDepositOutgoingMutation(
	// 	@Body() input: DepositOutgoingPaymentInputDTO,
	// 	@Req() req,
	// 	@Res() res
	// ) {
	// 	try {
	// 		await addApiSignatureHeader(req, req.body);
	// 		const inputDeposit = {
	// 			outgoingPaymentId: input?.outgoingPaymentId,
	// 			idempotencyKey: uuidv4(),
	// 		};
	// 		const depositMutation =
	// 			await this.walletService.createDepositOutgoingMutationService(
	// 				inputDeposit
	// 			);
	// 		return res.status(200).send({
	// 			data: depositMutation,
	// 			customCode: 'WGE0161',
	// 		});
	// 	} catch (error) {
	// 		Sentry.captureException(error);
	// 		return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
	// 			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
	// 			customCode: 'WGE0162',
	// 		});
	// 	}
	// }

	@Post('create-deposit')
	@ApiOperation({ summary: 'Create a deposit' })
	@ApiResponse({ status: 201, description: 'deposit created successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async createDeposit(@Body() input: DepositDTO, @Req() req, @Res() res) {
		try {
			const deposit = await this.walletService.createDeposit(input);
			if (!deposit) {
				return res.status(HttpStatus.BAD_REQUEST).send({
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0175',
				});
			}
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0172',
				data: {
					wallet: {
						walletDb: deposit,
					},
				},
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0173',
			});
		}
	}

	@Get(':id/asset')
	@ApiOperation({ summary: 'Get wallet address by rafikyId' })
	@ApiResponse({
		status: 200,
	})
	@ApiResponse({
		status: 500,
	})
	async getAssetByRafikyId(
		@Param('id') id: string,
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

			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0021',
			});
		}

		try {
			const asset = await this.walletService.getAssetByRafikyId(id);

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0081',
				data: { asset },
			});
		} catch (error) {
			Sentry.captureException(error);

			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0083',
			});
		}
	}

	@Post('create/incoming-payment')
	@ApiOperation({ summary: 'Create a Incoming Payment' })
	@ApiResponse({
		status: 201,
		description: 'InconmingPayment created successfully.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async createIncomingPayment(
		@Body() input: CreatePaymentDTO,
		@Req() req,
		@Res() res,
		@Headers() headers: MapOfStringToList
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
				customCode: 'WGE0021',
			});
		}

		try {
			await addApiSignatureHeader(req, req.body);

			const userWallet = await this.walletService.getWalletByRafikyId(
				input.walletAddressId
			);

			if (!userWallet) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
			}

			const userWalletByToken = convertToCamelCase(
				await this.walletService.getWalletByToken(token)
			);

			if (userWalletByToken?.walletDb?.userId !== userWallet?.userId) {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
				});
			}

			const providerWallet = await this.walletService.getWalletByAddress(
				input.walletAddressUrl
			);

			if (!providerWallet) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
			}

			const incomingPayment = await this.walletService.createIncomingPayment(
				input,
				providerWallet,
				userWalletByToken
			);

			if (incomingPayment?.customCode) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: incomingPayment?.customCode,
				});
			}

			return res.status(HttpStatus.OK).send({
				data: {
					incomingPaymentResponse: convertToCamelCase(incomingPayment),
				},
				statusCode: HttpStatus.OK,
				customCode: 'WGE0164',
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0165',
				message: error.message,
			});
		}
	}

	@Post('action/outgoing-payment')
	@ApiOperation({ summary: 'Action outgoing payment' })
	@ApiResponse({
		status: 201,
		description: 'Action outgoing payment created successfully.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	async actionOutgoingPayment(
		@Body() input: ActionOugoingPaymentDto,
		@Req() req,
		@Res() res,
		@Headers() headers: MapOfStringToList
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
				customCode: 'WGE0021',
			});
		}

		try {
			await addApiSignatureHeader(req, req.body);

			const incomingPayment = await this.walletService.completePayment(
				input?.outgoingPaymentId,
				input?.action
			);

			if (incomingPayment?.action == 'hc') {
				this.authGateway.server.emit(incomingPayment?.action, {
					message: 'Payment request accepted',
					statusCode: 'WGS0054',
				});

				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0210',
				});
			} else {
				this.authGateway.server.emit(incomingPayment?.action, {
					message: 'Payment request rejected',
					statusCode: 'WGS0055',
				});
				return res.status(HttpStatus.BAD_REQUEST).send({
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: incomingPayment?.statusCode,
				});
			}
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0211',
				message: error.message,
			});
		}
	}

	@Get('list-incoming-payments')
	@ApiOperation({ summary: 'List all user incoming payments' })
	async listIncomingPayments(
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

		try {
			const incomingPayments = await this.walletService.listIncomingPayments(
				token
			);

			if (incomingPayments?.customCode) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: incomingPayments?.customCode,
				});
			}
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: { incomingPayments },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
				message: error.message,
			});
		}
	}

	@Patch(':id/cancel-incoming')
	@ApiOkResponse({
		description: 'Incoming Payment has been cancelled.',
	})
	async cancelIncoming(
		@Param('id') id: string,
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
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			const response = await this.walletService.cancelIncomingPaymentId(
				id,
				token
			);

			if (response?.customCode) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: response?.customCode,
				});
			}

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0166',
				data: response,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			});
		}
	}
}
