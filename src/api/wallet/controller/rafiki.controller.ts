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
	ApiCreatedResponse,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { CreateServiceProviderWalletAddressDto } from '../dto/create-rafiki-service-provider-wallet-address.dto';
import { customValidationPipe } from '../../validation.pipe';
import {
	addApiSignatureHeader,
	addHostHeader,
} from 'src/utils/helpers/signatureHelper';
import {
	ActionOugoingPaymentDto,
	CreateQuoteInputDTO,
	DepositDTO,
	DepositOutgoingPaymentInputDTO,
	GeneralReceiverInputDTO,
	LinkInputDTO,
	ReceiverInputDTO,
	UnLinkInputDTO,
} from '../dto/payments-rafiki.dto';
import { isValidStringLength } from 'src/utils/helpers/isValidStringLength';
import { v4 as uuidv4 } from 'uuid';
import { PaymentService } from '../service/payments.service';
import {
	AuthOpenPaymentGrantInputDTO,
	IncomingOpenPaymentDTO,
	OutgoingOpenPaymentDTO,
	OutgoingPaymentAuthInputDTO,
} from '../dto/payments-open-payment.dt';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';
import { CreatePaymentDTO } from '../dto/create-payment-rafiki.dto';
import { AuthGateway } from '../service/websocket';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { adjustValue } from 'src/utils/helpers/generalAdjustValue';
import { Model } from 'dynamoose/dist/Model';
import { Transaction } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';
import { UserWsGateway } from '../service/websocket-users';
import {
	getGrantForIncomingPayment,
	unifiedProcess,
} from 'src/utils/helpers/openPaymentMethods';
import { toBase64 } from 'src/utils/helpers/openPaymentSignature';
import { GraphqlService } from 'src/graphql/graphql.service';
import { calcularTotalCostoWalletGuru } from '../../../utils/helpers/calcularCostoWalletGuru';

@ApiTags('wallet-rafiki')
@Controller('api/v1/wallets-rafiki')
@ApiBearerAuth('JWT')
export class RafikiWalletController {
	private readonly AUTH_MICRO_URL: string;
	private dbTransactions: Model<Transaction>;

	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService,
		private readonly graphqlService: GraphqlService,
		private readonly paymentService: PaymentService,
		private readonly authGateway: AuthGateway,
		private readonly userWsGateway: UserWsGateway,
		private configService: ConfigService
	) {
		this.AUTH_MICRO_URL = process.env.AUTH_URL;
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
	@ApiOperation({ summary: 'Retrieve all Rafiki assets' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Assets successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const rafikiAssets = await this.walletService.getRafikiAssets();
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0081',
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
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Get('list-transactions')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, type: String })
	@ApiQuery({ name: 'userType', required: false, type: String })
	@ApiQuery({
		name: 'orderBy',
		required: false,
		isArray: true,
		type: String,
		description: 'Order by fields (e.g., providerId, date)',
	})
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'state', required: false, type: String })
	@ApiQuery({ name: 'providerIds', required: false, type: [String] })
	@ApiQuery({ name: 'activityId', required: false, type: String })
	@ApiQuery({ name: 'walletAddress', required: false, type: String })
	@ApiQuery({ name: 'isRevenue', required: false, type: Boolean })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiOperation({ summary: 'List all user transactions' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully retrieved.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async listTransactions(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('search') search?: string,
		@Query('type') type?: string,
		@Query('userType') userType?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('state') state?: string,
		@Query('providerIds') providerIds?: string | string[],
		@Query('activityId') activityId?: string,
		@Query('walletAddress') walletAddress?: string,
		@Query('page') page?: string,
		@Query('items') items?: string,
		@Query('isRevenue') isRevenue?: boolean,
		@Query('orderBy') orderBy?: ('providerId' | 'date')[]
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
			let parsedProviderIds: string[] = [];
			if (typeof providerIds === 'string') {
				try {
					parsedProviderIds = JSON.parse(providerIds);
					if (!Array.isArray(parsedProviderIds)) {
						parsedProviderIds = providerIds?.split(',');
					}
				} catch {
					parsedProviderIds = providerIds?.split(',');
				}
			} else if (Array.isArray(providerIds)) {
				parsedProviderIds = providerIds;
			}
			let rangeDate = undefined;
			if (startDate && endDate) {
				rangeDate = { start: startDate, end: endDate };
			} else {
				if (startDate) {
					const endAxu = new Date();
					rangeDate = {
						start: startDate,
						end: `${
							endAxu.getMonth() + 1
						}/${endAxu.getDate()}/${endAxu.getFullYear()}`,
					};
				} else if (endDate) {
					const startAxu = new Date(2024, 1, 10);
					rangeDate = {
						start: `${startAxu.getMonth()}/${startAxu.getDate()}/${startAxu.getFullYear()}`,
						end: endDate,
					};
				}
			}
			// console.log('rangeDate', rangeDate);
			const filters = {
				type,
				userType,
				dateRange: rangeDate,
				state,
				providerIds: parsedProviderIds,
				activityId,
				transactionType: undefined,
				walletAddress,
				page,
				items,
				orderBy,
				isRevenue,
			};
			if (userTypeInfo === 'WALLET') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else if (userTypeInfo === 'PROVIDER') {
				filters.providerIds = parsedProviderIds;
				filters.transactionType = ['incoming', 'outgoing'];
			} else if (userTypeInfo === 'PLATFORM') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const transactions = await this.walletService.listTransactions(
				token,
				search,
				filters,
				userTypeInfo
			);

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: { ...transactions },
			});
		} catch (error) {
			console.log('error', error);
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			});
		}
	}

	@Get('transaction')
	@ApiQuery({ name: 'transacctionIds', required: false, type: [String] })
	@ApiOperation({ summary: 'Detail transaction ids' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async transactionDetailIds(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('transacctionIds') transacctionIds?: string[]
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
			//TODO: Add user type validation

			const transactions = await this.walletService.getBatchTransactions(
				transacctionIds
			);

			if (!transactions) {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGS0138',
					data: transactions,
				});
			}
			await Promise.all(
				transactions.map(async transaction => {
					transaction.fee = 0;
					const walletInfo = await this.walletService.getWalletByAddress(
						transaction.receiverUrl
					);
					const scale =
						transaction.receiveAmount?.assetScale ||
						transaction.incomingAmount?.assetScale ||
						6;
					const codeAsset =
						transaction.receiveAmount?.assetCode ||
						transaction.incomingAmount?.assetCode ||
						'USD';
					const costTransaction =
						transaction.receiveAmount?.value ||
						transaction.incomingAmount?.value ||
						0;
					if (walletInfo) {
						if (walletInfo?.providerId) {
							const paymentParameters =
								await this.walletService.getPaymentsParameters(
									walletInfo.providerId
								);
							if (paymentParameters) {
								const paymentParameter =
									paymentParameters?.find(
										parameter =>
											parameter?.cost === adjustValue(costTransaction, scale)
									) || paymentParameters?.[0];
								const fees = adjustValue(
									calcularTotalCostoWalletGuru(
										paymentParameter?.base,
										paymentParameter?.comision,
										paymentParameter?.cost,
										paymentParameter?.percent,
										scale
									),
									scale
								);
								transaction.fee = fees;
							}
						}
					}
				})
			);

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: transactions,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			});
		}
	}

	@Get('transaction/:id')
	@ApiOperation({ summary: 'Detail transaction' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transaction successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async transactionDetail(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Param('id') id: string
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
			//TODO: Add user type validation

			const transaction = await this.walletService.getTransactionById(id);

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: { ...transaction },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			});
		}
	}

	@Get('download-transactions-provider')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, type: String })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'state', required: false, type: String })
	@ApiQuery({ name: 'providerIds', required: false, type: [String] })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiOperation({ summary: 'Download all provider transactions' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully downloaded.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async donwloadProvider(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('search') search?: string,
		@Query('type') type?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('state') state?: string,
		@Query('providerIds') providerIds?: string | string[],
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
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;
			const userType = userInfo?.data?.type;

			let parsedProviderIds: string[] = [];
			if (typeof providerIds === 'string') {
				try {
					parsedProviderIds = JSON.parse(providerIds);
					if (!Array.isArray(parsedProviderIds)) {
						parsedProviderIds = providerIds?.split(',');
					}
				} catch {
					parsedProviderIds = providerIds?.split(',');
				}
			} else if (Array.isArray(providerIds)) {
				parsedProviderIds = providerIds;
			}
			let rangeDate = undefined;
			if (startDate && endDate) {
				rangeDate = { start: startDate, end: endDate };
			} else {
				if (startDate) {
					const endAxu = new Date();
					rangeDate = {
						start: startDate,
						end: `${
							endAxu.getMonth() + 1
						}/${endAxu.getDate()}/${endAxu.getFullYear()}`,
					};
				} else if (endDate) {
					const startAxu = new Date(2024, 1, 10);
					rangeDate = {
						start: `${startAxu.getMonth()}/${startAxu.getDate()}/${startAxu.getFullYear()}`,
						end: endDate,
					};
				}
			}

			const filters = {
				type,
				dateRange: rangeDate,
				state,
				providerIds: parsedProviderIds,
				transactionType: undefined,
				page,
				items,
			};

			if (userType === 'PROVIDER') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const paginatedTransactions = await this.walletService.listTransactions(
				token,
				search,
				filters
			);
			await this.walletService.generateCsv(
				res,
				paginatedTransactions?.transactions
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0227',
			});
		}
	}

	@Get('download-transactions-activity')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, type: String })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'state', required: false, type: String })
	@ApiQuery({ name: 'activityId', required: false, type: String })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiOperation({ summary: 'Download all transactions by activityId' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully downloaded.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async donwloadTransactionActivity(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('search') search?: string,
		@Query('type') type?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('state') state?: string,
		@Query('activityId') activityId?: string,
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

			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0022',
			});
		}

		try {
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;
			const userType = userInfo?.data?.type;
			let rangeDate = undefined;
			if (startDate && endDate) {
				rangeDate = { start: startDate, end: endDate };
			} else {
				if (startDate) {
					const endAxu = new Date();
					rangeDate = {
						start: startDate,
						end: `${
							endAxu.getMonth() + 1
						}/${endAxu.getDate()}/${endAxu.getFullYear()}`,
					};
				} else if (endDate) {
					const startAxu = new Date(2024, 1, 10);
					rangeDate = {
						start: `${startAxu.getMonth()}/${startAxu.getDate()}/${startAxu.getFullYear()}`,
						end: endDate,
					};
				}
			}

			const filters = {
				type,
				dateRange: rangeDate,
				state,
				transactionType: undefined,
				activityId,
				page,
				items,
			};

			if (userType === 'PLATFORM') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const paginatedTransactions = await this.walletService.listTransactions(
				token,
				search,
				filters
			);
			await this.walletService.generateCsv(
				res,
				paginatedTransactions?.transactions
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0227',
			});
		}
	}

	@Get('download-transactions-user')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, type: String })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'state', required: false, type: String })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiQuery({ name: 'walletAddress', required: false, type: String })
	@ApiQuery({ name: 'activityId', required: false, type: String })
	@ApiQuery({ name: 'providerIds', required: false, type: [String] })
	@ApiOperation({ summary: 'Download all user transactions' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully downloaded.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async downloadUser(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('search') search?: string,
		@Query('type') type?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('state') state?: string,
		@Query('page') page?: string,
		@Query('items') items?: string,
		@Query('walletAddress') walletAddress?: string,
		@Query('activityId') activityId?: string,
		@Query('providerIds') providerIds?: string | string[]
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
				customCode: 'WGE0022',
			});
		}

		try {
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;
			const userType = userInfo?.data?.type;

			let parsedProviderIds: string[] = [];
			if (typeof providerIds === 'string') {
				try {
					parsedProviderIds = JSON.parse(providerIds);
					if (!Array.isArray(parsedProviderIds)) {
						parsedProviderIds = providerIds?.split(',');
					}
				} catch {
					parsedProviderIds = providerIds?.split(',');
				}
			} else if (Array.isArray(providerIds)) {
				parsedProviderIds = providerIds;
			}

			let rangeDate = undefined;
			if (startDate && endDate) {
				rangeDate = { start: startDate, end: endDate };
			} else {
				if (startDate) {
					const endAxu = new Date();
					rangeDate = {
						start: startDate,
						end: `${
							endAxu.getMonth() + 1
						}/${endAxu.getDate()}/${endAxu.getFullYear()}`,
					};
				} else if (endDate) {
					const startAxu = new Date(2024, 1, 10);
					rangeDate = {
						start: `${startAxu.getMonth()}/${startAxu.getDate()}/${startAxu.getFullYear()}`,
						end: endDate,
					};
				}
			}

			const filters = {
				type,
				dateRange: rangeDate,
				state,
				providerIds: parsedProviderIds,
				activityId,
				transactionType: undefined,
				walletAddress,
				page,
				items,
			};

			if (userType === 'PROVIDER') {
				filters.providerIds = parsedProviderIds;
				filters.transactionType = ['incoming', 'outgoing'];
			} else if (userType === 'PLATFORM') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const paginatedTransactions = await this.walletService.listTransactions(
				token,
				search,
				filters,
				userType
			);
			await this.walletService.generateCsv(
				res,
				paginatedTransactions?.transactions
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0227',
			});
		}
	}

	@Get('download-transactions-user-provider')
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'type', required: false, type: String })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'state', required: false, type: String })
	@ApiQuery({ name: 'providerIds', required: false, type: [String] })
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiOperation({ summary: 'Download all user provider transactions' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Transactions successfully downloaded.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async downloadUserProvider(
		@Headers() headers: Record<string, string>,
		@Res() res,
		@Query('search') search?: string,
		@Query('type') type?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('state') state?: string,
		@Query('providerIds') providerIds?: string | string[],
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

			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0022',
			});
		}

		try {
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;
			const userType = userInfo?.data?.type;

			let parsedProviderIds: string[] = [];
			if (typeof providerIds === 'string') {
				try {
					parsedProviderIds = JSON.parse(providerIds);
					if (!Array.isArray(parsedProviderIds)) {
						parsedProviderIds = providerIds?.split(',');
					}
				} catch {
					parsedProviderIds = providerIds?.split(',');
				}
			} else if (Array.isArray(providerIds)) {
				parsedProviderIds = providerIds;
			}
			let rangeDate = undefined;
			if (startDate && endDate) {
				rangeDate = { start: startDate, end: endDate };
			} else {
				if (startDate) {
					const endAxu = new Date();
					rangeDate = {
						start: startDate,
						end: `${
							endAxu.getMonth() + 1
						}/${endAxu.getDate()}/${endAxu.getFullYear()}`,
					};
				} else if (endDate) {
					const startAxu = new Date(2024, 1, 10);
					rangeDate = {
						start: `${startAxu.getMonth()}/${startAxu.getDate()}/${startAxu.getFullYear()}`,
						end: endDate,
					};
				}
			}

			const filters = {
				type,
				dateRange: rangeDate,
				state,
				providerIds: parsedProviderIds,
				transactionType: undefined,
				page,
				items,
			};

			if (userType === 'PROVIDER') {
				filters.transactionType = ['incoming', 'outgoing'];
			} else {
				return res.status(HttpStatus.UNAUTHORIZED).send({
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0022',
				});
			}

			const paginatedTransactions = await this.walletService.listTransactions(
				token,
				search,
				filters
			);
			await this.walletService.generateCsv(
				res,
				paginatedTransactions?.transactions
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0227',
			});
		}
	}

	@Post('transaction')
	@ApiOperation({ summary: 'Create a new transaction' })
	@ApiBearerAuth('JWT')
	@ApiCreatedResponse({ description: 'Transaction successfully created.' })
	@ApiResponse({ status: 400, description: 'Bad request.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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

				const inputOutgoing = {
					walletAddressId: input?.walletAddressId,
					quoteId: quote?.createQuote?.quote?.id,
					metadata: {
						type: 'USER',
						wgUser: userId,
						description: '',
					},
				};
				const outgoingPayment = await this.walletService.createOutgoingPayment(
					inputOutgoing
				);

				await this.walletService.sendMoneyMailConfirmation(
					inputOutgoing,
					outgoingPayment
				);

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
	@ApiOperation({ summary: 'Create a transaction to link a service provider' })
	@ApiBearerAuth('JWT')
	@ApiCreatedResponse({ description: 'Service provider successfully linked.' })
	@ApiResponse({ status: 400, description: 'Bad request.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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

			this.authGateway.sendDataSessionId('hc', input?.sessionId, {
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
	@ApiOperation({ summary: 'Retrieve linked service providers' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Service providers successfully retrieved.' })
	@ApiResponse({ status: 400, description: 'Bad request.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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

	@Post('service-provider-unlink')
	@ApiOperation({ summary: 'Unlink a service provider by session id' })
	@ApiBearerAuth('JWT')
	@ApiCreatedResponse({
		description: 'Service provider successfully unlinked.',
	})
	@ApiResponse({ status: 400, description: 'Bad request.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async unlinkTransactionProvider(
		@Headers() headers: MapOfStringToList,
		@Body() input: UnLinkInputDTO,
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

			const linkProvider =
				await this.walletService.unlinkServiceProviderBySessionId(
					input?.sessionId
				);

			if (linkProvider?.customCode) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: linkProvider?.customCode,
				});
			}

			this.authGateway.server.emit('hc', {
				message: 'Account unlinked',
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
	@ApiOperation({ summary: 'Retrieve all exchange rates' })
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Exchange rates successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Deposit created successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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

	@Post('create-transaction-open-payment')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				senderWalletAddress: { type: 'string', example: '' },
				receiverWalletAddress: { type: 'string', example: '' },
				amount: { type: 'string', example: '' },
				assetCode: { type: 'string', example: '' },
				assetScale: { type: 'string', example: '' },
				metadata: { type: 'object', example: {} },
				authHost: { type: 'string', example: '' },
				paymentHost: { type: 'string', example: '' },
				interactionHost: { type: 'string', example: '' },
			},
		},
		description: 'auth open payment',
	})
	@ApiOperation({ summary: 'Open payment - Create transaction' })
	async createTransactionOpenPayments(
		@Body('senderWalletAddress') senderWalletAddress: string,
		@Body('receiverWalletAddress') receiverWalletAddress: string,
		@Body('amount') amount: string,
		@Body('assetCode') assetCode: string,
		@Body('assetScale') assetScale: string,
		@Body('metadata') metadata: object,
		@Body('authHost') authHost: string,
		@Body('paymentHost') paymentHost: string,
		@Body('interactionHost') interactionHost: string,
		@Req() req,
		@Res() res
	) {
		try {
			const walletKey = await this.walletService.findWalletByUrl(
				senderWalletAddress
			);

			const privateKey = walletKey?.PrivateKey;
			const keyId = walletKey?.KeyId;

			const walletBase64 = await toBase64(privateKey);

			const walletInfoSender = await this.graphqlService.listWalletInfo(
				walletKey.RafikiId
			);

			const quoteDebitAmount = {
				value: amount,
				assetCode:
					walletInfoSender?.data?.walletAddress?.asset?.code ??
					assetCode ??
					'USD',
				assetScale:
					walletInfoSender?.data?.walletAddress?.asset?.scale ??
					assetScale ??
					6,
			};
			const expirationDate = new Date(
				Date.now() + 24 * 60 * 60 * 1000
			).toISOString();
			const clientKey = keyId;
			const clientPrivate = walletBase64;

			const generalMetadata = {
				description: '',
			};

			const result = await unifiedProcess(
				authHost,
				paymentHost,
				interactionHost,
				receiverWalletAddress,
				senderWalletAddress,
				quoteDebitAmount,
				req,
				clientKey,
				clientPrivate,
				metadata ?? generalMetadata,
				metadata ?? generalMetadata,
				expirationDate
			);
			return res.status(200).send({
				data: result,
				customCode: 'WGE0150',
			});
		} catch (error) {
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Get(':id/asset')
	@ApiOperation({ summary: 'Get wallet address by Rafiki ID' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Wallet address retrieved successfully.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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
	@ApiOperation({ summary: 'Create an Incoming Payment' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Incoming Payment created successfully.' })
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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
				customCode: 'WGE0155',
			});
		}
	}

	@Post('action/outgoing-payment')
	@ApiOperation({ summary: 'Execute an outgoing payment action' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({
		description: 'Outgoing payment action successfully executed.',
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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
	@ApiQuery({ name: 'status', required: false, type: Boolean })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiQuery({ name: 'walletAddress', required: false, type: String })
	@ApiQuery({ name: 'serviceProviderId', required: false, type: String })
	@ApiOperation({ summary: 'List all incoming payments' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Incoming payments retrieved successfully.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async listIncomingPayments(
		@Headers() headers: MapOfStringToList,
		@Res() res,
		@Query('status') status?: boolean,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('walletAddress') walletAddress?: string,
		@Query('serviceProviderId') serviceProviderId?: string
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
			let userInfo = await axios.get(
				this.AUTH_MICRO_URL + '/api/v1/users/current-user',
				{
					headers: {
						Authorization: token,
					},
				}
			);
			userInfo = userInfo.data;

			const incomingPayments = await this.walletService.listIncomingPayments(
				token,
				startDate,
				endDate,
				walletAddress,
				serviceProviderId,
				status,
				userInfo
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
	@ApiOperation({ summary: 'Cancel an incoming payment by ID' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Incoming payment cancelled successfully.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 404, description: 'Incoming payment not found.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
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

	// @Get('test')
	// @ApiOperation({ summary: 'Test WebSocket for a user by userId' })
	// @ApiOkResponse({ description: 'WebSocket test message sent successfully.' })
	// @ApiResponse({ status: 400, description: 'Bad Request' })
	// @ApiResponse({ status: 401, description: 'Unauthorized access.' })
	// @ApiResponse({ status: 404, description: 'User not found.' })
	// @ApiResponse({ status: 500, description: 'Server error.' })
	// async testWsUser(
	// 	@Headers() headers: MapOfStringToList,
	// 	@Req() req,
	// 	@Res() res
	// ) {
	// 	this.userWsGateway.sendBalance('', {
	// 		pendingCredit: 0,
	// 		pendingDebit: 0,
	// 		postedCredit: 0,
	// 		postedDebit: 0,
	// 	});
	// 	return res.status(200).send({
	// 		statusCode: HttpStatus.OK,
	// 		customCode: 'WGE0150',
	// 	});
	// }

	@Post('auth-payment')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				clientWalletAddress: { type: 'string', example: '0x123456789abcdef' },
			},
		},
		description: 'auth open payment',
	})
	@ApiOperation({ summary: 'Open payment - auth payment' })
	async postAuthPayment(
		@Body('clientWalletAddress') clientWalletAddress: string,
		@Req() req,
		@Res() res
	) {
		try {
			console.log('entro');
			await addApiSignatureHeader(req, req.body);
			console.log('paso signature');
			return this.paymentService.postAuthPayment(clientWalletAddress, req.body);
		} catch (error) {
			console.log('error', error?.message);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Post('incoming-payment')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				receiverWalletAddress: { type: 'string', example: '0x123456789abcdef' },
			},
		},
		description: 'Incoming open payment',
	})
	@ApiOperation({ summary: 'Open payment - incoming payment' })
	async incomingPayment(
		@Body('receiverWalletAddress') receiverWalletAddress: string,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			await addHostHeader(req, process.env.URL_BASE_OPEN_PAYMENTS);
			return this.paymentService.createIncomingPayment(receiverWalletAddress);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Post('outgoing-payment-auth')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				senderWalletAddress: { type: 'string', example: '0x987654321fedcba' },
				clientWalletAddress: { type: 'string', example: '0xa1b2c3d4e5f67890' },
				debitAmount: { type: 'number', example: 100 },
				receiveAmount: { type: 'number', example: 95 },
			},
		},
		description: 'Outgoing payment authentication',
	})
	@ApiOperation({ summary: 'Open payment - outgoing payment' })
	async outgoingPaymentAuth(
		@Body('senderWalletAddress') senderWalletAddress: string,
		@Body('clientWalletAddress') clientWalletAddress: string,
		@Body('debitAmount') debitAmount: number,
		@Body('receiveAmount') receiveAmount: number,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			return this.paymentService.postOutgoingPaymentAuth(
				senderWalletAddress,
				clientWalletAddress,
				debitAmount,
				receiveAmount
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Post('continue/:continueId')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				interact_ref: { type: 'string', example: 'ref12345' },
			},
		},
		description: 'Continue open payment interaction',
	})
	@ApiOperation({ summary: 'Open payment - continue' })
	async continueInteraction(
		@Param('continueId') continueId: string,
		@Body('interact_ref') interactRef: string,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			return this.paymentService.continueInteraction(continueId, interactRef);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Post('outgoing-payment')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				senderWalletAddress: { type: 'string', example: '0x123456789abcdef' },
				incomingPaymentUrl: {
					type: 'string',
					example: 'https://payment-url.com',
				},
				debitAmount: { type: 'number', example: 150 },
			},
		},
		description: 'Create outgoing open payment',
	})
	@ApiOperation({ summary: 'Open payment - create outgoing payment' })
	async outgoingPayment(
		@Body('senderWalletAddress') senderWalletAddress: string,
		@Body('incomingPaymentUrl') incomingPaymentUrl: string,
		@Body('debitAmount') debitAmount: number,
		@Req() req,
		@Res() res
	) {
		try {
			await addApiSignatureHeader(req, req.body);
			return this.paymentService.createOutgoingPayment(
				senderWalletAddress,
				incomingPaymentUrl,
				debitAmount
			);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}

	@Get('outgoing-payment/:outgoingPaymentId')
	@ApiOperation({ summary: 'Open payment - get outgoing payment' })
	async getOutgoingPayment(
		@Param('outgoingPaymentId') outgoingPaymentId: string,
		@Req() req,
		@Res() res
	) {
		try {
			await addHostHeader(req, process.env.URL_BASE_OPEN_PAYMENTS);
			await addApiSignatureHeader(req, req.body);
			return this.paymentService.getOutgoingPayment(outgoingPaymentId);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0155',
			});
		}
	}
}
