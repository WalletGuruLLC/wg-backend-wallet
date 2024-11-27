import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import {
	CreateSocketDto,
	CreateWalletDto,
	UpdateWalletDto,
} from '../dto/wallet.dto';
import * as Sentry from '@sentry/nestjs';
import { ApolloError } from '@apollo/client/errors';
import axios from 'axios';
import { createHmac } from 'crypto';
import { GraphqlService } from '../../../graphql/graphql.service';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { CreateServiceProviderWalletAddressDto } from '../dto/create-rafiki-service-provider-wallet-address.dto';
import { errorCodes } from 'src/utils/constants';
import { generatePublicKeyRafiki } from 'src/utils/helpers/generatePublicKeyRafiki';
import { generateJwk } from 'src/utils/helpers/jwk';
import { convertToCamelCase } from '../../../utils/helpers/convertCamelCase';
import { canonicalize } from 'json-canonicalize';
import { SocketKey } from '../entities/socket.entity';
import { SocketKeySchema } from '../entities/socket.schema';
import { Rates } from '../entities/rates.entity';
import { RatesSchema } from '../entities/rates.schema';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { CreateIncomingUserDto } from '../dto/incoming-user.dto';
import { SqsService } from '../sqs/sqs.service';
import { UserIncomingPayment } from '../entities/user-incoming.entity';
import { UserIncomingSchema } from '../entities/user-incoming.schema';
import { CreatePaymentDTO } from '../dto/create-payment-rafiki.dto';
import { Transaction, TransactionType } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';
import { User } from '../entities/user.entity';
import { UserSchema } from '../entities/user.schema';
import { adjustValue } from 'src/utils/helpers/generalAdjustValue';
import { calcularTotalCosto } from 'src/utils/helpers/calcularTotalTransactionPlat';
import { parseStringToBoolean } from 'src/utils/helpers/parseStringToBoolean';
import { AuthGateway } from './websocket';
import { calcularTotalCostoWalletGuru } from 'src/utils/helpers/calcularCostoWalletGuru';
import * as fastCsv from 'fast-csv';
import { flattenObject } from 'src/utils/helpers/flattenObject';
import { WebSocketAction } from '../entities/webSocketAction.entity';
import { WebSocketActionSchema } from '../entities/webSocketAction.schema';
import { CreateWebSocketActionDto } from '../dto/create-web-socket-action.dto';
import { ClearPayments } from '../entities/clear-payments.entity';
import { ClearPaymentsSchema } from '../entities/clear-payments.schema';
import { buildFilterExpression } from '../../../utils/helpers/buildFilterExpressionDynamo';
import { getDateRangeForMonthEnum } from 'src/utils/helpers/buildMonthRanges';
import { Month } from '../dto/month.enum';
import { CreateRefundsDto } from '../dto/create-refunds.dto';
import { RefundsEntity } from '../entities/refunds.entity';
import { RefundsSchema } from '../entities/refunds.schema';
import { ConfirmClearPayment } from '../dto/confirm-clear-payment.';
import { validarPermisos } from '../../../utils/helpers/getAccessServiceProviders';
import {
	createOutgoingPayment,
	createQuote,
} from 'src/utils/helpers/openPaymentMethods';
import { toBase64 } from 'src/utils/helpers/openPaymentSignature';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private dbInstanceSocketLogs: Model<WebSocketAction>;
	private dbInstanceSocket: Model<SocketKey>;
	private dbIncomingUser: Model<UserIncomingPayment>;
	private dbTransactions: Model<Transaction>;
	private dbUserInstance: Model<User>;
	private dbRates: Model<Rates>;
	private dbClearPayments: Model<ClearPayments>;
	private dbUserIncoming: Model<UserIncomingPayment>;
	private dbRefunds: Model<RefundsEntity>;
	private readonly AUTH_MICRO_URL: string;
	private readonly DOMAIN_WALLET_URL: string;
	private readonly WALLET_WG_URL: string;

	constructor(
		private configService: ConfigService,
		private readonly graphqlService: GraphqlService,
		private readonly sqsService: SqsService,
		private authGateway: AuthGateway
	) {
		this.dbUserInstance = dynamoose.model<User>('Users', UserSchema);
		this.dbInstanceSocketLogs = dynamoose.model<User>(
			'WebSocketActions',
			WebSocketActionSchema
		);
		this.dbIncomingUser = dynamoose.model<UserIncomingPayment>(
			'UserIncoming',
			UserIncomingSchema
		);
		this.dbInstance = dynamoose.model<Wallet>('Wallets', WalletSchema);
		this.dbInstanceSocket = dynamoose.model<SocketKey>(
			'SocketKeys',
			SocketKeySchema
		);

		this.dbUserIncoming = dynamoose.model<UserIncomingPayment>(
			'UserIncoming',
			UserIncomingSchema
		);
		this.dbTransactions = dynamoose.model<Transaction>(
			'Transactions',
			TransactionsSchema
		);
		this.dbClearPayments = dynamoose.model<ClearPayments>(
			'ClearPayments',
			ClearPaymentsSchema
		);
		this.dbRates = dynamoose.model<Rates>('Rates', RatesSchema);
		this.dbRefunds = dynamoose.model<RefundsEntity>('Refunds', RefundsSchema);
		this.AUTH_MICRO_URL = process.env.AUTH_URL;
		this.DOMAIN_WALLET_URL = process.env.DOMAIN_WALLET_URL;
		this.WALLET_WG_URL = process.env.WALLET_WG_URL;
	}

	async createIncoming(createIncomingUserDto: CreateIncomingUserDto) {
		try {
			const createIncomingDtoConverted = {
				IncomingPaymentId: createIncomingUserDto.incomingPaymentId,
				ServiceProviderId: createIncomingUserDto.serviceProviderId,
				UserId: createIncomingUserDto.userId,
			};
			return this.dbIncomingUser.create(createIncomingDtoConverted);
		} catch (error) {
			Sentry.captureException(error);
			console.log(`Failed incoming: ${error.message}`);
		}
	}

	async createWebsocketLogs(
		createWebSocketActionDto: CreateWebSocketActionDto
	) {
		try {
			const filteredData = Object.fromEntries(
				Object?.entries(createWebSocketActionDto)?.filter(
					([_, value]) => value !== undefined
				)
			);
			return this.dbInstanceSocketLogs.create(filteredData);
		} catch (error) {
			Sentry.captureException(error);
			console.log(`Failed to log event: ${error.message}`);
		}
	}

	//SERVICE TO CREATE A WALLET
	//SERVICE TO CREATE A WALLET
	async create(
		createWalletDto: CreateWalletDto,
		rafikiId?: string,
		userId?: string,
		providerId?: string
	) {
		try {
			if (!rafikiId && !userId) {
				const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*\.[^\s]{2,}$/i;
				if (!urlRegex.test(createWalletDto.walletAddress)) {
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0084',
							customMessage: errorCodes.WGE0084?.description,
							customMessageEs: errorCodes.WGE0084?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
				}
			}

			const createWalletDtoConverted = {
				Name: createWalletDto.name,
				WalletType: createWalletDto.walletType,
				WalletAddress: createWalletDto.walletAddress.toLowerCase(),
			} as any;

			let existingRafikiUser: any = [];
			let existingUser: any = [];

			if (rafikiId) {
				existingRafikiUser = await this.dbInstance
					.scan('RafikiId')
					.eq(rafikiId)
					.exec();
				createWalletDtoConverted.RafikiId = rafikiId;
			}
			if (userId) {
				existingUser = await this.dbInstance.scan('UserId').eq(userId).exec();
				createWalletDtoConverted.UserId = userId;
			}
			if (providerId) {
				createWalletDtoConverted.ProviderId = providerId;
			}

			// Check if the WalletAddress already exists
			const existingWallets = await this.dbInstance
				.scan('WalletAddress')
				.eq(createWalletDto.walletAddress.toLowerCase())
				.exec();

			if (
				existingWallets.count > 0 ||
				existingRafikiUser.count > 0 ||
				existingUser.count > 0
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.BAD_REQUEST,
						customCode: 'WGE0086',
						customMessage: errorCodes.WGE0086?.description,
						customMessageEs: errorCodes.WGE0086?.descriptionEs,
					},
					HttpStatus.BAD_REQUEST
				);
			}

			const createdWallet = await this.dbInstance.create(
				createWalletDtoConverted
			);
			const camelCaseWallet = {
				id: createdWallet?.Id,
				name: createdWallet?.Name,
				walletType: createdWallet?.WalletType,
				walletAddress: createdWallet?.WalletAddress,
				active: createdWallet?.Active,
			} as any;

			if (rafikiId) {
				camelCaseWallet.rafikiId = createdWallet.RafikiId;
			}

			if (userId) {
				camelCaseWallet.userId = createdWallet.UserId;
			}

			if (providerId) {
				camelCaseWallet.providerId = createdWallet.ProviderId;
			}

			if (userId) {
				const docClient = new DocumentClient();

				const userParams = {
					TableName: 'Users',
					Key: {
						Id: userId,
					},
					UpdateExpression: 'SET #State = :state',
					ExpressionAttributeNames: {
						'#State': 'State',
					},
					ExpressionAttributeValues: {
						':state': 4,
					},
					ReturnValues: 'ALL_NEW',
				};

				await docClient.update(userParams).promise();
			}

			return camelCaseWallet;
		} catch (error) {
			Sentry.captureException(error);
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0085',
						customMessage: errorCodes.WGE0085?.description,
						customMessageEs: errorCodes.WGE0085?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	//SERVICE TO FIND THE SELECTED WALLET
	async findOne(id: string): Promise<Wallet | null> {
		try {
			return await this.dbInstance.get({ Id: id });
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error retrieving user: ${error.message}`);
		}
	}

	//SERVICE TO UPDATE THE SELECTED WALLET
	async update(
		id: string,
		updateWalletDto: UpdateWalletDto
	): Promise<Wallet | null> {
		try {
			const updateWalletDtoConverted = {
				Id: id,
				Name: updateWalletDto?.name?.trim(),
				WalletType: updateWalletDto?.walletType?.trim(),
				WalletAddress: updateWalletDto?.walletAddress?.trim(),
			};

			const updateObject = Object.entries(updateWalletDtoConverted).reduce(
				(acc, [key, value]) => {
					if (value !== undefined && value !== '') {
						acc[key] = value;
					}
					return acc;
				},
				{ Id: id } as any // Type as `any` to allow dynamic key assignment
			);

			return await this.dbInstance.update(updateObject);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error updating wallet: ${error.message}`);
		}
	}

	//SERVICE TO GET ALL WALLETS
	async getWallets(getWalletDto: any) {
		try {
			const {
				search = '',
				page = '1',
				items = '10',
				active,
				walletType,
				walletAddress,
			} = getWalletDto;

			const pageNumber = parseInt(page, 10);
			const itemsNumber = parseInt(items, 10);
			const activeBoolean =
				active !== undefined ? active === 'true' : undefined;

			const startIndex = (pageNumber - 1) * itemsNumber;

			// Fetch all wallets
			const wallets = await this.dbInstance
				.scan()
				.attributes([
					'Id',
					'Name',
					'WalletType',
					'WalletAddress',
					'Active',
					'CreateDate',
					'UpdateDate',
				])
				.exec();

			const totalWallets = await this.dbInstance.scan().exec();

			const walletsCountNotNative = totalWallets.filter(
				wallet => wallet.WalletType !== 'Native'
			);

			const totalCount = walletsCountNotNative.length;

			// Filter wallets based on the search query and other filters
			const filteredWallets = wallets.filter(wallet => {
				const matchesSearch = search
					? wallet.Name.toLowerCase().includes(search.toLowerCase()) ||
					  wallet.Id.toLowerCase().includes(search.toLowerCase())
					: true;

				const matchesActive =
					activeBoolean !== undefined ? wallet.Active === activeBoolean : true;

				const matchesWalletType = walletType
					? wallet.WalletType === walletType && wallet.WalletType !== 'Native'
					: wallet.WalletType !== 'Native'; // Exclude 'Native' wallets

				const matchesWalletAddress = walletAddress
					? wallet.WalletAddress === walletAddress
					: true;

				return (
					matchesSearch &&
					matchesActive &&
					matchesWalletType &&
					matchesWalletAddress
				);
			});

			// Sort by active (true first, false after) and by name (A-Z)
			const sortedWallets = filteredWallets.sort((a, b) => {
				if (a.Active === b.Active) {
					return a.Name.localeCompare(b.Name);
				}
				return a.Active ? -1 : 1;
			});

			// Convert and paginate the wallets
			const convertedWalletsArray = sortedWallets.map(wallet => ({
				id: wallet.Id,
				name: wallet.Name,
				walletType: wallet.WalletType || '',
				walletAddress: wallet.WalletAddress || '',
				active: wallet.Active || false,
			}));

			// Paginate the results
			const paginatedWallets = convertedWalletsArray.slice(
				startIndex,
				startIndex + itemsNumber
			);

			return {
				paginatedWallets,
				totalCount,
			};
		} catch (error) {
			Sentry.captureException(error);
			throw new Error('Failed to retrieve wallets. Please try again later.');
		}
	}

	// SERVICE TO TOGGLE (ACTIVATE/INACTIVATE) WALLETS
	async toggle(id: string) {
		const role = await this.findOne(id);

		role.Active = !role.Active;
		const updatedRole = await this.dbInstance.update(id, {
			Active: role.Active,
		});

		return {
			id: updatedRole?.Id,
			name: updatedRole?.Name,
			walletType: updatedRole?.WalletType,
			walletAddress: updatedRole?.WalletAddress,
			active: updatedRole?.Active,
		};
	}

	async findWallet(id: string): Promise<Wallet> {
		const walletById = await this.dbInstance.scan('Id').eq(id).exec();
		return walletById[0];
	}

	async findWalletByUserId(userId: string): Promise<any> {
		const walletById = await this.dbInstance
			.scan()
			.filter('UserId')
			.eq(userId)
			.exec();

		const walletInfo = await this.graphqlService.listWalletInfo(
			walletById?.[0]?.RafikiId
		);
		return {
			walletDb: walletById?.[0]?.RafikiId,
			walletUrl: walletById?.[0]?.WalletAddress,
			walletAsset: walletInfo.data.walletAddress.asset,
		};
	}

	async findWalletByUrl(address: string): Promise<any> {
		const walletByUrl = await this.dbInstance
			.scan('WalletAddress')
			.eq(address)
			.exec();
		return walletByUrl[0];
	}

	async findWalletByName(name: string): Promise<any> {
		const walletByName = await this.dbInstance.scan('Name').eq(name).exec();
		return walletByName[0];
	}

	async getWalletAddressExist(address: string) {
		const wallets = await this.dbInstance
			.scan('WalletAddress')
			.eq(address)
			.exec();
		if (wallets?.[0]) {
			return 'exist';
		} else {
			return 'don’t found';
		}
	}

	async generateKeys() {
		const pairs = await generatePublicKeyRafiki();
		return pairs;
	}

	async updateKeys(id, pairs, keyId) {
		await this.dbInstance.update(id, {
			PrivateKey: pairs?.privateKeyPEM,
			PublicKey: pairs?.publicKeyPEM,
			KeyId: 'keyid-' + keyId,
		});
		return pairs;
	}

	async createWalletAddress(
		createRafikiWalletAddressDto: CreateRafikiWalletAddressDto,
		token: string
	) {
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
		if (userId && (await this.isUserIdExists(userId))) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0082',
					customMessage: errorCodes.WGE0082?.description,
					customMessageEs: errorCodes.WGE0082?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}
		const walletAddress = `${this.DOMAIN_WALLET_URL}/${createRafikiWalletAddressDto.addressName}`;

		const isWalletAddressTakenLocally = await this.isWalletAddressTakenLocally(
			walletAddress
		);
		if (isWalletAddressTakenLocally) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0081',
					customMessage: errorCodes.WGE0081?.description,
					customMessageEs: errorCodes.WGE0081?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}
		//TODO: replace publicName with a default value when there are no names
		const createRafikiWalletAddressInput = {
			walletAddress,
			assetId: createRafikiWalletAddressDto.assetId,
			publicName: `${userInfo?.data?.firstName} ${userInfo?.data?.lastName}`,
		};

		let createdRafikiWalletAddress;
		const pairs = await this.generateKeys();
		const keyId = uuidv4();
		const jwk = await generateJwk(pairs?.privateKey, 'keyid-' + keyId);

		try {
			createdRafikiWalletAddress = await this.createWalletAddressGraphQL(
				createRafikiWalletAddressInput,
				jwk
			);
		} catch (error) {
			Sentry.captureException(error);
			if (error instanceof ApolloError) {
				if (
					error.message.includes(
						'duplicate key value violates unique constraint "walletaddresses_url_unique"'
					)
				) {
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0081',
							customMessage: errorCodes.WGE0081?.description,
							customMessageEs: errorCodes.WGE0081?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
				} else if (error.message.includes('unknown asset')) {
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0080',
							customMessage: errorCodes.WGE0080?.description,
							customMessageEs: errorCodes.WGE0080?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
				}
			}
			throw error;
		}

		const wallet = {
			name: 'Wallet Guru',
			walletType: 'Native',
			walletAddress: createRafikiWalletAddressInput.walletAddress,
			rafikiId:
				createdRafikiWalletAddress.createWalletAddress?.walletAddress?.id,
			userId,
		};
		if (userInfo?.data?.first) {
			userInfo = await axios.put(
				this.AUTH_MICRO_URL + `/api/v1/users/${userId}/toggle-first`,
				{},
				{
					headers: {
						Authorization: token,
					},
				}
			);
		}
		const walletCreated = await this.create(
			wallet,
			wallet.rafikiId,
			wallet.userId
		);
		const walletInfo = await this.graphqlService.listWalletInfo(
			wallet.rafikiId
		);
		if (walletCreated.rafikiId) {
			delete walletCreated.rafikiId;
		}
		await this.updateKeys(walletCreated?.id, pairs, keyId);

		return {
			walletDb: walletCreated,
			walletAsset: walletInfo.data.walletAddress.asset,
			balance: 0,
			reserved: 0,
		};
	}

	async createServiceProviderWalletAddress(
		createServiceProviderWalletAddressDto: CreateServiceProviderWalletAddressDto
	) {
		if (
			createServiceProviderWalletAddressDto.providerId &&
			(await this.isProviderIdExists(
				createServiceProviderWalletAddressDto.providerId
			))
		) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0082',
					customMessage: errorCodes.WGE0082?.description,
					customMessageEs: errorCodes.WGE0082?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}
		const walletAddress = `${this.DOMAIN_WALLET_URL}/${createServiceProviderWalletAddressDto.addressName}`;

		const isWalletAddressTakenLocally = await this.isWalletAddressTakenLocally(
			walletAddress
		);
		if (isWalletAddressTakenLocally) {
			throw new HttpException(
				{
					statusCode: HttpStatus.BAD_REQUEST,
					customCode: 'WGE0081',
					customMessage: errorCodes.WGE0081?.description,
					customMessageEs: errorCodes.WGE0081?.descriptionEs,
				},
				HttpStatus.BAD_REQUEST
			);
		}

		const createRafikiWalletAddressInput = {
			walletAddress,
			assetId: createServiceProviderWalletAddressDto.assetId,
			publicName: `${createServiceProviderWalletAddressDto.providerName}`,
		};

		const pairs = await this.generateKeys();
		const keyId = uuidv4();
		const jwk = await generateJwk(pairs?.privateKey, keyId);
		let createdRafikiWalletAddress;
		try {
			createdRafikiWalletAddress = await this.createWalletAddressGraphQL(
				createRafikiWalletAddressInput,
				jwk
			);
		} catch (error) {
			Sentry.captureException(error);
			if (error instanceof ApolloError) {
				if (
					error.message.includes(
						'duplicate key value violates unique constraint "walletaddresses_url_unique"'
					)
				) {
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0081',
							customMessage: errorCodes.WGE0081?.description,
							customMessageEs: errorCodes.WGE0081?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
				} else if (error.message.includes('unknown asset')) {
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0080',
							customMessage: errorCodes.WGE0080?.description,
							customMessageEs: errorCodes.WGE0080?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
				}
			}
			throw error;
		}

		const wallet = {
			name: 'Wallet Guru',
			walletType: 'Native',
			walletAddress: createRafikiWalletAddressInput.walletAddress,
			rafikiId:
				createdRafikiWalletAddress.createWalletAddress?.walletAddress?.id,
			providerId: createServiceProviderWalletAddressDto.providerId,
		};
		const walletCreated = await this.create(
			wallet,
			wallet.rafikiId,
			null,
			wallet.providerId
		);
		await this.updateKeys(walletCreated?.id, pairs, keyId);
		return walletCreated;
	}

	private async isProviderIdExists(providerId: string): Promise<boolean> {
		const existingWallet = await this.dbInstance
			.scan()
			.filter('ProviderId')
			.eq(providerId)
			.exec();
		return existingWallet.count > 0;
	}

	private async isUserIdExists(userId: string): Promise<boolean> {
		const existingWallet = await this.dbInstance
			.scan()
			.filter('UserId')
			.eq(userId)
			.exec();
		return existingWallet.count > 0;
	}

	private async isWalletAddressTakenLocally(
		walletAddress: string
	): Promise<boolean> {
		const existingWallet = await this.dbInstance
			.query('WalletAddress')
			.eq(walletAddress)
			.using('WalletAddressIndex')
			.exec();
		return existingWallet.count > 0;
	}

	private async createWalletAddressGraphQL(
		createRafikiWalletAddressInput: any,
		jwk
	) {
		//TODO: improve remaining input values, for now some things are hardcoded
		const input = {
			assetId: createRafikiWalletAddressInput.assetId,
			url: createRafikiWalletAddressInput.walletAddress,
			publicName: createRafikiWalletAddressInput.publicName,
			additionalProperties: [
				{
					key: 'iban',
					value: 'NL93 8601 1117 947',
					visibleInOpenPayments: true,
				},
				{ key: 'mobile', value: '+31121212', visibleInOpenPayments: false },
			],
		};

		const result = await this.graphqlService.createWalletAddress(input);

		const inputWalletKey = {
			walletAddressId: result?.createWalletAddress?.walletAddress?.id,
			jwk,
		};

		await this.graphqlService.createWalletAddressKey(inputWalletKey);

		return result;
	}

	async getRafikiAssets() {
		const assets = await this.graphqlService.getAssets(null, null, null, null);
		return assets.map(asset => ({
			code: asset.code,
			id: asset.id,
		}));
	}

	async getAssetByRafikyId(rafikyId: string) {
		try {
			const walletAddress = await this.graphqlService.getWalletAddressAsset(
				rafikyId
			);
			return walletAddress;
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				'Failed to get wallet address asset by rafikyId. Please try again later.'
			);
		}
	}

	async filterRafikiAssetById(assetId: string) {
		const assets = await this.getRafikiAssets();
		const filteredAsset = assets.find(asset => asset?.id === assetId);

		if (!filteredAsset) {
			return {};
		}

		return filteredAsset;
	}

	async getWalletByToken(token: any): Promise<{
		walletDb: Wallet;
		walletAsset: any;
	}> {
		const walletDb = await this.getUserByToken(token);

		const walletInfo = await this.graphqlService.listWalletInfo(
			walletDb.RafikiId
		);

		return {
			walletDb: walletDb,
			walletAsset: walletInfo.data.walletAddress.asset,
		};
	}

	paginatedResults(page, itemsPerPage, results) {
		const offset = (page - 1) * itemsPerPage;
		const total = results.length;
		const totalPages = Math.ceil(total / itemsPerPage);
		const paginatedTransactions = results.slice(
			offset,
			offset + Number(itemsPerPage)
		);

		return convertToCamelCase({
			transactions: paginatedTransactions,
			currentPage: page,
			total,
			totalPages,
		});
	}

	async listTransactions(
		token: string,
		search: string,
		filters?: {
			type?: string;
			userType?: string;
			dateRange?: { start: string; end: string };
			state?: string;
			providerIds?: string[];
			activityId?: string;
			transactionType?: string[];
			walletAddress?: string;
			page?: string;
			items?: string;
			orderBy?: ('providerId' | 'date')[];
		},
		type?: string
	) {
		if (!search) {
			search = 'all';
		}
		const walletDb = await this.getUserByToken(token);
		const providerId = await this.getProviderIdByUserToken(token);
		const walletDbProvider = await this.getWalletAddressByProviderId(
			providerId
		);

		const WalletAddress =
			type == 'PROVIDER'
				? walletDbProvider?.walletAddress
				: walletDb?.WalletAddress;
		const docClient = new DocumentClient();

		let validWalletFilter = true;

		if (filters?.walletAddress) {
			const walletFind = await this.getWalletByAddressRegex(
				filters.walletAddress
			);

			const isProviderType = type === 'PROVIDER';
			const isWalletType = type === 'WALLET';
			const hasDifferentWalletAddress =
				walletFind?.walletAddress &&
				walletFind.walletAddress !== walletDbProvider?.walletAddress;

			if (walletFind?.providerId) {
				if (isProviderType && hasDifferentWalletAddress) {
					validWalletFilter = false;
				} else if (isWalletType) {
					validWalletFilter = false;
				}
			}
		}

		const pagedParsed = Number(filters?.page) || 1;
		const itemsParsed = Number(filters?.items) || 10;
		const filterExpression =
			type == 'PLATFORM'
				? '#Type = :TypeIncoming OR #Type = :TypeOutgoing'
				: '(#ReceiverUrl = :WalletAddress AND #Type = :TypeIncoming) OR (#SenderUrl = :WalletAddress AND #Type = :TypeOutgoing)';

		const outgoingParams: DocumentClient.ScanInput = {
			TableName: 'Transactions',
			FilterExpression: filterExpression,
			ExpressionAttributeNames: {
				'#Type': 'Type',
				...(type !== 'PLATFORM' && {
					'#SenderUrl': 'SenderUrl',
					'#ReceiverUrl': 'ReceiverUrl',
				}),
			},
			ExpressionAttributeValues: {
				':TypeIncoming': 'IncomingPayment',
				':TypeOutgoing': 'OutgoingPayment',
				...(type !== 'PLATFORM' && { ':WalletAddress': WalletAddress }),
			},
		};

		console.log('outgoingParams', outgoingParams);
		const dynamoOutgoingPayments = await docClient
			.scan(outgoingParams)
			.promise();
		console.log('dynamoOutgoingPayments', dynamoOutgoingPayments?.Items[0]);

		if (dynamoOutgoingPayments?.Items?.length > 0) {
			const sortedArray = dynamoOutgoingPayments?.Items?.sort(
				(a: any, b: any) =>
					new Date(b?.createdAt)?.getTime() - new Date(a?.createdAt)?.getTime()
			);

			const transactionsWithNames: any = await Promise.all(
				sortedArray.map(async transaction => {
					const senderWallet = await this.getWalletByAddress(
						transaction?.SenderUrl
					);
					const receiverWallet = await this.getWalletByAddress(
						transaction?.ReceiverUrl
					);

					let senderName = 'Unknown';
					let receiverName = 'Unknown';

					if (senderWallet?.userId) {
						const senderWalletInfo = await this.getUserInfoById(
							senderWallet?.userId
						);
						if (senderWalletInfo) {
							senderName = `${senderWalletInfo?.firstName} ${senderWalletInfo?.lastName}`;
						}
					}

					if (receiverWallet?.userId) {
						const receiverWalletInfo = await this.getUserInfoById(
							receiverWallet?.userId
						);
						if (receiverWalletInfo) {
							receiverName = `${receiverWalletInfo?.firstName} ${receiverWalletInfo?.lastName}`;
						}
					}

					if (senderName === 'Unknown' && senderWallet?.providerId) {
						const senderProviderInfo = await this.getProviderById(
							senderWallet?.providerId
						);
						if (senderProviderInfo) {
							senderName = senderProviderInfo?.name;
						}
					}

					if (receiverName === 'Unknown' && receiverWallet?.providerId) {
						const receiverProviderInfo = await this.getProviderById(
							receiverWallet?.providerId
						);
						if (receiverProviderInfo) {
							receiverName = receiverProviderInfo?.name;
						}
					}

					return {
						...transaction,
						senderName,
						receiverName,
					};
				})
			);
			let validWallets = [];
			if (filters?.providerIds?.length) {
				const providerWalletsPromises = filters?.providerIds?.map(
					async providerId => {
						const provider = await this.getWalletAddressByProviderId(
							providerId
						);
						return provider?.walletAddress;
					}
				);
				const providerWallets = await Promise.all(providerWalletsPromises);
				validWallets = providerWallets.filter(
					walletAddress => walletAddress != null
				);
			}
			const filteredTransactions = transactionsWithNames.filter(transaction => {
				const matchesActivityId = filters?.activityId
					? transaction?.Metadata?.activityId === filters.activityId
					: true;
				const matchesType = filters?.type
					? transaction?.Type === filters?.type
					: true;
				const matchesState = filters?.state
					? transaction?.State === filters?.state
					: true;

				const matchesDateRange = filters?.dateRange
					? new Date(transaction?.createdAt) >=
							new Date(filters?.dateRange?.start) &&
					  new Date(transaction?.createdAt) <=
							new Date(filters?.dateRange?.end)
					: true;

				const matchesProviderId =
					validWallets.length > 0
						? validWallets.some(
								walletAddress => walletAddress === transaction?.ReceiverUrl
						  ) && transaction?.Metadata?.type === 'PROVIDER'
						: true;

				const matchesWalletAddress =
					type !== 'WALLET' && filters?.walletAddress && validWalletFilter
						? transaction?.ReceiverUrl?.includes(filters?.walletAddress) ||
						  transaction?.SenderUrl?.includes(filters?.walletAddress)
						: true;

				const matchesUserType = filters?.userType
					? transaction?.Metadata?.type === filters?.userType
					: true;

				return (
					matchesActivityId &&
					matchesType &&
					matchesState &&
					matchesDateRange &&
					matchesProviderId &&
					matchesWalletAddress &&
					matchesUserType
				);
			});

			if (filters?.orderBy?.length) {
				filteredTransactions?.sort((a, b) => {
					for (const field of filters.orderBy) {
						if (field === 'providerId') {
							const aProviderId = a?.Metadata?.providerId || '';
							const bProviderId = b?.Metadata?.providerId || '';
							if (aProviderId < bProviderId) return -1;
							if (aProviderId > bProviderId) return 1;
						} else if (field === 'date') {
							const aDate = new Date(a?.createdAt).getTime();
							const bDate = new Date(b?.createdAt).getTime();
							return aDate - bDate;
						}
					}
					return 0;
				});
			}

			const isIncoming = filters?.transactionType?.includes('incoming');
			const isOutgoing = filters?.transactionType?.includes('outgoing');

			let sortedTransactions;

			if (isIncoming && isOutgoing) {
				sortedTransactions = this.paginatedResults(
					pagedParsed,
					itemsParsed,
					convertToCamelCase(filteredTransactions)
				);
			} else if (isIncoming) {
				sortedTransactions = this.paginatedResults(
					pagedParsed,
					itemsParsed,
					filteredTransactions.filter(t => t?.Type === 'IncomingPayment')
				);
			} else if (isOutgoing) {
				sortedTransactions = this.paginatedResults(
					pagedParsed,
					itemsParsed,
					filteredTransactions.filter(t => t?.Type === 'OutgoingPayment')
				);
			}

			if (filters?.transactionType) {
				return sortedTransactions;
			}

			const incomingSorted = filteredTransactions.filter(
				item => item?.Type === 'IncomingPayment'
			);
			const outgoingSorted = filteredTransactions.filter(
				item => item?.Type === 'OutgoingPayment'
			);
			const combinedSorted = [...incomingSorted, ...outgoingSorted].sort(
				(a: any, b: any) =>
					new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime()
			);

			return search === 'credit'
				? convertToCamelCase(incomingSorted)
				: search === 'debit'
				? convertToCamelCase(outgoingSorted)
				: convertToCamelCase(combinedSorted);
		} else {
			return [];
		}
	}

	async listIncomingPayments(
		token: string,
		startDate?: string,
		endDate?: string,
		walletAddress?: string,
		serviceProviderId?: string,
		state?: any,
		userInfo?: any
	) {
		const userWallet = await this.getUserByToken(token);
		const userLogged = await this.getUserInfoById(userWallet?.UserId);
		const startTimestamp = startDate ? new Date(startDate).getTime() : null;
		const endTimestamp = endDate ? new Date(endDate).getTime() : null;
		let userIncomingPayment: any[];
		if (userLogged.type === 'PLATFORM') {
			if (!serviceProviderId) {
				serviceProviderId = userLogged.serviceProviderId;
			}
			const docClient = new DocumentClient();
			const params = {
				TableName: 'Roles',
				Key: { Id: userLogged.roleId },
			};
			console.log(serviceProviderId);
			const result = await docClient.get(params).promise();
			const role = result.Item;
			const permisos = validarPermisos({
				role,
				requestedModuleId: 'RF86',
				requiredMethod: 'GET',
				userId: userLogged.id,
				serviceProviderId,
			});

			if (!permisos.hasAccess) {
				return { customCode: permisos.customCode };
			}

			userIncomingPayment = await this.getIncomingPaymentsByUser(
				userWallet?.UserId,
				state,
				userInfo,
				serviceProviderId,
				startTimestamp,
				endTimestamp,
				walletAddress
			);
		} else if (userLogged.type === 'PROVIDER') {
			userIncomingPayment = await this.getIncomingPaymentsByUser(
				userWallet?.UserId,
				state,
				userInfo,
				userLogged.serviceProviderId,
				startTimestamp,
				endTimestamp,
				walletAddress
			);
		}else if(userLogged.type === 'WALLET'){
			userIncomingPayment = await this.getIncomingPaymentsByUser(
				userWallet?.UserId,
				state,
				userInfo,
				null,
				startTimestamp,
				endTimestamp,
				walletAddress
			);
		}

		if (userIncomingPayment?.[0]?.state == 'BLANK') {
			return userIncomingPayment;
		}

		const incomingPayments = [];

		await Promise.all(
			userIncomingPayment?.map(async userIncomingPayment => {
				const incomingPayment = await this.getIncomingPayment(
					userIncomingPayment?.incomingPaymentId
				);
				const user = await this.getWalletUserById(userWallet?.UserId);

				const providerWallet = await this.getWalletByRafikyId(
					incomingPayment.walletAddressId
				);

				const provider = await this.getWalletByProviderId(
					providerWallet?.providerId
				);

				if (
					incomingPayment.state !== 'COMPLETED' &&
					incomingPayment.state !== 'EXPIRED'
				) {
					const updatedIncomingPayment = {
						...incomingPayment,
						incomingAmount: {
							...incomingPayment.incomingAmount,
							value: (
								parseInt(incomingPayment?.incomingAmount?.value ?? '0') -
								parseInt(incomingPayment?.receivedAmount?.value ?? '0')
							).toString(),
						},
					};

					const incomingConverted = {
						type: updatedIncomingPayment.__typename,
						id: updatedIncomingPayment.id,
						provider: provider.name,
						ownerUser: `${user?.firstName} ${user?.lastName}`,
						state: updatedIncomingPayment.state,
						incomingAmount: updatedIncomingPayment?.incomingAmount,
						createdAt: updatedIncomingPayment.createdAt,
						expiresAt: updatedIncomingPayment?.expiresAt,
					};
					incomingPayments.push(incomingConverted);
				}
			})
		);

		const incomingSorted = incomingPayments.sort(
			(a: any, b: any) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		return convertToCamelCase(incomingSorted);
	}

	async listClearPayments(filters, provider) {
		const docClient = new DocumentClient();

		const { page, items, month, providerId, ...filterRest } = filters;

		const pagedParsed = Number(filters?.page) || 1;
		const itemsParsed = Number(filters?.items) || 10;

		const expression = buildFilterExpression(filterRest);
		const clearPaymentsParams: DocumentClient.QueryInput = {
			TableName: 'ClearPayments',
			IndexName: 'ServiceProviderIdIndex',
			KeyConditionExpression: `ServiceProviderId  = :serviceProviderId`,

			...(expression.filterExpression && {
				FilterExpression: expression.filterExpression,
			}),
			...(Object.keys(expression.attributeNames).length && {
				ExpressionAttributeNames: expression.attributeNames,
			}),
			...(Object.keys(expression?.expressionValues).length && {
				ExpressionAttributeValues: {
					...expression?.expressionValues,
				},
			}),
		};

		const { ExpressionAttributeValues } = clearPaymentsParams;

		const clearPaymentsParamsWithService = {
			...clearPaymentsParams,
			...(!ExpressionAttributeValues && {
				ExpressionAttributeValues: {
					':serviceProviderId': providerId,
				},
			}),
			...(Object.keys(ExpressionAttributeValues).length && {
				ExpressionAttributeValues: {
					...ExpressionAttributeValues,
					':serviceProviderId': providerId,
				},
			}),
		};

		const currentDate = new Date();

		const calculatedMonth = month ? month : currentDate.getMonth()

		const monthRanges = getDateRangeForMonthEnum(calculatedMonth);

		const clearPayments = await docClient
			.query(clearPaymentsParamsWithService)
			.promise();

		const filteredClearPayments = convertToCamelCase(
			clearPayments?.Items
		).filter(clearPayment => {
			const startDateTimestamp = clearPayment?.startDate;
			const endDateTimestamp = clearPayment?.endDate;
			return (
				startDateTimestamp >= monthRanges.startDate &&
				endDateTimestamp <= monthRanges.endDate
			);
		});

		const paginatedResults = await this.paginatedResults(
			pagedParsed,
			itemsParsed,
			filteredClearPayments
		);

		const { transactions, ...paginated } = paginatedResults;

		const clearPaymentsTransformed = transactions.map(transaction => {
			return {
				...transaction,
				provider: provider?.name,
				month: Month[calculatedMonth],
			};
		});
		const results = {
			clearPayments: clearPaymentsTransformed,
			...paginated,
		};

		return convertToCamelCase(results);
	}

	async generateCsv(res, transactions: any[]) {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0'); // Mes con 2 dígitos
		const day = String(now.getDate()).padStart(2, '0');

		const filename = `${year}-${month}-${day}.csv`;

		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		res.setHeader('Content-Type', 'text/csv');

		const csvStream = fastCsv.format({ headers: true, delimiter: ';' });
		csvStream.pipe(res);

		transactions.forEach(transaction => {
			const flatTransaction = flattenObject(transaction);
			csvStream.write(flatTransaction);
		});

		csvStream.end();
	}

	async getUserByToken(token: string) {
		let userInfo = await axios.get(
			this.AUTH_MICRO_URL + '/api/v1/users/current-user',
			{ headers: { Authorization: token } }
		);
		userInfo = userInfo.data;

		const walletByUserId = await this.dbInstance
			.scan('UserId')
			.eq(userInfo.data.id)
			.attributes([
				'UserId',
				'CreateDate',
				'UpdateDate',
				'WalletType',
				'Id',
				'Active',
				'Name',
				'RafikiId',
				'PostedCredits',
				'PostedDebits',
				'PendingCredits',
				'PendingDebits',
				'WalletAddress',
			])
			.exec();
		return walletByUserId[0];
	}

	async getProviderIdByUserToken(token: string) {
		let userInfo = await axios.get(
			this.AUTH_MICRO_URL + '/api/v1/users/current-user',
			{
				headers: {
					Authorization: token,
				},
			}
		);
		userInfo = userInfo.data;

		const providerId = userInfo?.data?.serviceProviderId;
		return providerId;
	}

	async createReceiver(input: any) {
		try {
			return await this.graphqlService.createReceiver(input);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error creating receiver: ${error.message}`);
		}
	}

	async expireDate() {
		const fechaActual = new Date();
		fechaActual.setMonth(fechaActual.getMonth() + 1);
		return `${fechaActual.toISOString()}`;
	}

	async currentDate() {
		const fechaActual = new Date();
		return `${fechaActual.toISOString()}`;
	}

	async createIncomingPayment(
		input: CreatePaymentDTO,
		providerWallet,
		userWallet
	): Promise<any> {
		try {
			const expireDate = await this.expireDate();
			const updateInput = {
				metadata: {
					description: '',
					type: 'PROVIDER',
					wgUser: userWallet.walletDb?.userId,
				},
				incomingAmount: {
					assetCode: userWallet?.walletAsset?.code,
					assetScale: userWallet?.walletAsset?.scale,
					value: adjustValue(
						input.incomingAmount,
						userWallet?.walletAsset?.scale
					),
				},
				walletAddressUrl: input.walletAddressUrl,
				// expiresAt: expireDate, //TODO: uncomment when the expire date is fixed
			};
			const balance =
				userWallet?.walletDb?.postedCredits -
				(userWallet?.walletDb?.pendingDebits +
					userWallet?.walletDb?.postedDebits);

			if (input.incomingAmount > balance) {
				return {
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0224',
				};
			}

			const incomingPayment = await this.graphqlService.createReceiver(
				updateInput
			);

			const providerWalletId =
				incomingPayment?.createReceiver?.receiver?.id.split('/');
			const incomingPaymentId = providerWalletId?.[4];

			const userIncomingPayment = {
				ServiceProviderId: providerWallet?.providerId,
				UserId: userWallet.walletDb?.userId,
				IncomingPaymentId: incomingPaymentId,
				ReceiverId: incomingPayment?.createReceiver?.receiver?.id,
				SenderUrl: userWallet?.walletDb?.walletAddress,
				ReceiverUrl: input?.walletAddressUrl,
			};

			return await this.dbUserIncoming.create(userIncomingPayment);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0165',
			};
		}
	}

	async cancelIncomingPaymentId(incomingPaymentId: string, token: string) {
		try {
			const docClient = new DocumentClient();
			const userIncoming = await this.getUserIncomingPaymentById(
				incomingPaymentId
			);
			const incomingPayment = await this.getIncomingPaymentById(
				incomingPaymentId
			);
			const userWallet = convertToCamelCase(await this.getUserByToken(token));

			if (!userIncoming) {
				return {
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0167',
				};
			}

			if (!incomingPayment) {
				return {
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0167',
				};
			}

			if (userIncoming?.status && userWallet) {
				const receivedAmount = parseInt(incomingPayment?.receivedAmount.value);
				const incomingValue = parseInt(incomingPayment.incomingAmount.value);
				const pendingDebits: number =
					(userWallet?.pendingDebits || 0) - (incomingValue - receivedAmount);

				const params = {
					Key: {
						Id: userWallet.id,
					},
					TableName: 'Wallets',
					UpdateExpression: 'SET PendingDebits = :pendingDebits',
					ExpressionAttributeValues: {
						':pendingDebits': pendingDebits,
					},
					ReturnValues: 'ALL_NEW',
				};

				const userIncomingParams = {
					Key: {
						Id: userIncoming.id,
					},
					TableName: 'UserIncoming',
					ExpressionAttributeNames: {
						'#status': 'Status',
					},
					UpdateExpression: 'SET #status = :status',
					ExpressionAttributeValues: {
						':status': false,
					},
					ReturnValues: 'ALL_NEW',
				};

				if (!receivedAmount) {
					await this.cancelIncomingPayment(incomingPaymentId);
				}

				const wallet = await docClient.update(params).promise();
				await docClient.update(userIncomingParams).promise();
				return wallet?.Attributes;
			}
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async getIncomingByServiceProviderAndUserId(
		serviceProviderId: string,
		userId: string
	) {
		try {
			const resultsByServiceProvider = await this.dbIncomingUser
				.query('ServiceProviderId')
				.eq(serviceProviderId)
				.exec();

			const filteredResults = resultsByServiceProvider?.filter(
				item => item?.UserId === userId
			);

			return filteredResults;
		} catch (error) {
			console.error('Error fetching incoming payments:', error?.message);
		}
	}

	async cancelUserIncomingPaymentId(incomingPaymentId: string, userId: string) {
		try {
			const docClient = new DocumentClient();
			const userIncoming = await this.getUserIncomingPaymentById(
				incomingPaymentId
			);
			const incomingPayment = await this.getIncomingPaymentById(
				incomingPaymentId
			);
			const userWallet = await this.getWalletByUser(userId);

			if (!userIncoming) {
				return {
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0167',
				};
			}

			if (!incomingPayment) {
				return {
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0167',
				};
			}

			if (userIncoming?.status && userWallet) {
				const receivedAmount = parseInt(incomingPayment?.receivedAmount.value);
				const incomingValue = parseInt(incomingPayment.incomingAmount.value);
				const pendingDebits: number =
					(userWallet?.pendingDebits || 0) - (incomingValue - receivedAmount);

				const params = {
					Key: {
						Id: userWallet.id,
					},
					TableName: 'Wallets',
					UpdateExpression: 'SET PendingDebits = :pendingDebits',
					ExpressionAttributeValues: {
						':pendingDebits': pendingDebits,
					},
					ReturnValues: 'ALL_NEW',
				};

				const userIncomingParams = {
					Key: {
						Id: userIncoming.id,
					},
					TableName: 'UserIncoming',
					ExpressionAttributeNames: {
						'#status': 'Status',
					},
					UpdateExpression: 'SET #status = :status',
					ExpressionAttributeValues: {
						':status': false,
					},
					ReturnValues: 'ALL_NEW',
				};

				if (!receivedAmount) {
					await this.cancelIncomingPayment(incomingPaymentId);
				}

				const wallet = await docClient.update(params).promise();
				await docClient.update(userIncomingParams).promise();
				return wallet?.Attributes;
			}
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async createQuote(input: any) {
		try {
			return await this.graphqlService.createQuote(input);
		} catch (error) {
			Sentry.captureException(error);

			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0151',
			};
		}
	}

	async createOutgoingPayment(input: any) {
		try {
			return await this.graphqlService.createOutgoingPayment(input);
		} catch (error) {
			Sentry.captureException(error);

			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0151',
			};
		}
	}

	async getOutgoingPayment(id: string) {
		try {
			return await this.graphqlService.getOutgoingPayment(id);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			};
		}
	}

	async getIncomingPayment(id: string) {
		try {
			return await this.graphqlService.getInconmingPayment(id);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			};
		}
	}

	async generateToken(
		body: any,
		timestamp: string,
		publicKey: string
	): Promise<string> {
		const socket = await this.dbInstanceSocket
			.scan('PublicKey')
			.eq(publicKey)
			.exec();
		const secret = socket?.[0]?.SecretKey;
		if (!secret) {
			return '';
		}
		const payload = `${timestamp}^${canonicalize(body)}`;
		const hmac = createHmac('sha256', secret);
		hmac.update(payload);
		const digest = hmac.digest('hex');
		return `${digest}`;
	}

	async getServiceProviderWihtPublicKey(publicKey: string): Promise<any> {
		const socket = await this.dbInstanceSocket
			.scan('PublicKey')
			.eq(publicKey)
			.exec();
		const objectSecret = socket?.[0];
		if (!objectSecret) {
			return '';
		}
		return objectSecret;
	}

	verifyToken(token: string, body: any, secret: string): boolean {
		const [timePart, digestPart] = token.split(', ');
		const timestamp = timePart.split('=')[1];
		const digest = digestPart.split('=')[1];

		const payload = `${timestamp}.${canonicalize(body)}`;

		const hmac = createHmac('sha256', secret);
		hmac.update(payload);
		const expectedDigest = hmac.digest('hex');

		return expectedDigest === digest;
	}

	async createSocketKey(
		createSocketKeyDto: CreateSocketDto
	): Promise<SocketKey> {
		const socketKey = {
			PublicKey: createSocketKeyDto.publicKey,
			SecretKey: createSocketKeyDto.secretKey,
			ServiceProviderId: createSocketKeyDto.serviceProviderId,
		};
		return this.dbInstanceSocket.create(socketKey);
	}

	async getExchangeRates(base: string) {
		if (!base) {
			base = 'USD';
		}
		const docClient = new DocumentClient();
		const params: DocumentClient.ScanInput = {
			TableName: 'Rates',
			FilterExpression: '#base = :base',
			ExpressionAttributeNames: {
				'#base': 'Base',
			},
			ExpressionAttributeValues: {
				':base': base,
			},
		};
		const result = await docClient.scan(params).promise();
		const resultCamelCase = convertToCamelCase(result.Items[0]);
		resultCamelCase.rates = result.Items[0].Rates;
		return resultCamelCase;
	}

	async createDepositOutgoingMutationService(input: any) {
		try {
			return await this.graphqlService.createDepositOutgoingMutation(input);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error creating deposit outoing mutation: ${error.message}`
			);
		}
	}

	async createDeposit(input: any) {
		const walletAddress = input.walletAddressId;
		const amount = input.amount;

		const walletDynamo = await this.dbInstance
			.scan('RafikiId')
			.eq(walletAddress)
			.exec();

		const userId = walletDynamo[0]?.UserId;
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Users',
			Key: { Id: userId },
		};
		const userDynamo = await docClient.get(params).promise();

		if (
			userDynamo.Item.FirstFunding !== undefined &&
			userDynamo.Item.FirstFunding === false
		) {
			const walletInfo = await this.graphqlService.listWalletInfo(
				walletAddress
			);
			const scale = walletInfo.data.walletAddress.asset.scale;
			const amountUpdated = amount * Math.pow(10, scale);

			const dynamoAmount = (walletDynamo[0].PostedCredits || 0) + amountUpdated;
			const db = await this.dbInstance.update({
				Id: walletDynamo[0].Id,
				PostedCredits: dynamoAmount,
			});
			if (db.PublicKey) {
				delete db.PublicKey;
			}
			if (db.PrivateKey) {
				delete db.PrivateKey;
			}
			if (db.RafikiId) {
				delete db.RafikiId;
			}

			const userIncomingParams = {
				Key: {
					Id: userId,
				},
				TableName: 'Users',
				UpdateExpression: 'SET FirstFunding = :firstFunding',
				ExpressionAttributeValues: {
					':firstFunding': true,
				},
				ReturnValues: 'ALL_NEW',
			};

			await docClient.update(userIncomingParams).promise();

			return await convertToCamelCase(db);
		} else {
			return;
		}
	}
	async getWalletByRafikyId(rafikiId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Wallets',
			IndexName: 'RafikiIdIndex',
			KeyConditionExpression: `RafikiId = :rafikiId`,
			ExpressionAttributeValues: {
				':rafikiId': rafikiId,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.NOT_FOUND,
				customCode: 'WGE0074',
			};
		}
	}

	async getIncomingPaymentsByUser(
		userId: string,
		status?: boolean,
		userInfo?: any,
		serviceProviderId?: string,
		startTimestamp?: number,
		endTimestamp?: number,
		walletAddress?: string
	) {
		const docClient = new DocumentClient();
		const linkedProviders = await this.getLinkedProvidersUserById(userId);
		const params: any = {
			TableName: 'UserIncoming',
			IndexName: 'UserIdIndex',
			KeyConditionExpression: 'UserId = :userId',
			ExpressionAttributeValues: {
				':userId': userId,
			},
		};

		if (status !== undefined) {
			params.FilterExpression = '#status = :status';
			params.ExpressionAttributeNames = {
				'#status': 'Status',
			};
			params.ExpressionAttributeValues[':status'] =
				parseStringToBoolean(status);
		}

		if (serviceProviderId) {
			params.FilterExpression = params.FilterExpression
				? `${params.FilterExpression} AND ServiceProviderId = :serviceProviderId`
				: 'ServiceProviderId = :serviceProviderId';
			params.ExpressionAttributeValues[':serviceProviderId'] =
				serviceProviderId;
		}

		if (startTimestamp && endTimestamp) {
			params.FilterExpression = params.FilterExpression
				? `${params.FilterExpression} AND createdAt BETWEEN :startTimestamp AND :endTimestamp`
				: 'createdAt BETWEEN :startTimestamp AND :endTimestamp';
			params.ExpressionAttributeValues[':startTimestamp'] = startTimestamp;
			params.ExpressionAttributeValues[':endTimestamp'] = endTimestamp;
		} else if (startTimestamp) {
			params.FilterExpression = params.FilterExpression
				? `${params.FilterExpression} AND createdAt >= :startTimestamp`
				: 'createdAt >= :startTimestamp';
			params.ExpressionAttributeValues[':startTimestamp'] = startTimestamp;
		} else if (endTimestamp) {
			params.FilterExpression = params.FilterExpression
				? `${params.FilterExpression} AND createdAt <= :endTimestamp`
				: 'createdAt <= :endTimestamp';
			params.ExpressionAttributeValues[':endTimestamp'] = endTimestamp;
		}

		if (walletAddress) {
			params.FilterExpression = params.FilterExpression
				? `${params.FilterExpression} AND SenderUrl = :senderUrl`
				: 'SenderUrl = :senderUrl';
			params.ExpressionAttributeValues[':senderUrl'] = walletAddress;
		}
		try {
			const result = await docClient.query(params).promise();

			if (!result?.Items?.length) {
				const expireDate = await this.expireDate();
				const currentDate = await this.currentDate();
				const provider = await this.getWalletByProviderId(
					linkedProviders?.[0]?.serviceProviderId
				);
				if (!provider?.name) {
					return [];
				}
				return [
					{
						type: 'IncomingPayment',
						id: uuidv4(),
						provider: provider?.name,
						ownerUser: `${userInfo?.data?.firstName} ${userInfo?.data?.lastName}`,
						state: 'BLANK',
						incomingAmount: {
							_Typename: 'Amount',
							assetScale: 2,
							assetCode: 'USD',
							value: '0',
						},
						createdAt: currentDate,
						expiresAt: expireDate,
					},
				];
			}

			return convertToCamelCase(result.Items);
		} catch (error) {
			console.log('error', error?.message);
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			};
		}
	}

	async getUserIncomingPaymentById(incomingPaymentId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'UserIncoming',
			IndexName: 'IncomingPaymentIdIndex',
			KeyConditionExpression: `IncomingPaymentId = :incomingPaymentId`,
			ExpressionAttributeValues: {
				':incomingPaymentId': incomingPaymentId,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result?.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async getBatchTransactions(transactionIds: string[]) {
		const docClient = new DocumentClient();
		const params = {
			RequestItems: {
				Transactions: {
					Keys: transactionIds.map(id => ({ Id: id })),
				},
			},
		};

		try {
			const result = await docClient.batchGet(params).promise();
			const existingTransactions = result.Responses.Transactions;
			return convertToCamelCase(existingTransactions);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0229',
			};
		}
	}

	async batchUpdateTransactions(transactionIds: string[]) {
		const docClient = new DocumentClient();

		try {
			Promise.all(
				transactionIds.map(async transactionId => {
					const transactionParam = {
						Key: {
							Id: transactionId,
						},
						TableName: 'Transactions',
						UpdateExpression: 'SET Pay = :pay',
						ExpressionAttributeValues: {
							':pay': true,
						},
						ReturnValues: 'ALL_NEW',
					};
					await docClient.update(transactionParam).promise();
				})
			);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0236',
			};
		}
	}

	async getTransactionByIncomingPaymentId(incomingPaymentId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Transactions',
			IndexName: 'IncomingPaymentIdIndex',
			KeyConditionExpression: `IncomingPaymentId = :incomingPaymentId`,
			ExpressionAttributeValues: {
				':incomingPaymentId': incomingPaymentId,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result?.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async getWalletUserById(userId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Users',
			Key: { Id: userId },
		};

		try {
			const result = await docClient.get(params).promise();
			return convertToCamelCase(result?.Item);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			};
		}
	}

	async getWalletByProviderId(providerId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Providers',
			Key: { Id: providerId },
		};

		try {
			const result = await docClient.get(params).promise();
			return convertToCamelCase(result?.Item);
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			};
		}
	}

	async getWalletAddressByProviderId(providerId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Wallets',
			IndexName: 'ProviderIdIndex',
			KeyConditionExpression: `ProviderId  = :providerId`,
			ExpressionAttributeValues: {
				':providerId': providerId,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			return {};
		}
	}

	async getIncomingPaymentById(incomingPaymentId: string) {
		try {
			const incomingPayment = await this.graphqlService.getIncomingPayment(
				incomingPaymentId
			);
			return incomingPayment;
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async createOutgoing(input: any) {
		try {
			return await this.graphqlService.createReceiver(input);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error creating receiver: ${error.message}`);
		}
	}

	async cancelOutgoingPayment(input: any) {
		try {
			return await this.graphqlService.cancelOutgoingPayment(input);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error cancel outgoing payment: ${error.message}`);
		}
	}

	async cancelIncomingPayment(id: string) {
		try {
			return await this.graphqlService.cancelIncomingPayment({ id: id });
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0167',
			};
		}
	}

	async filterParameterById(parameters: Array<any>, parameterId: string) {
		const filteredAsset = parameters?.find(
			parameter => parameter?.id == parameterId
		);

		if (!filteredAsset) {
			return {};
		}

		return filteredAsset;
	}

	async getPaymentsParameters(serviceProviderId: string): Promise<any> {
		const docClient = new DocumentClient();

		const params: DocumentClient.ScanInput = {
			TableName: 'PaymentParameters',
			IndexName: 'ServiceProviderIdIndex',
			FilterExpression: 'ServiceProviderId = :serviceProviderId',
			ExpressionAttributeValues: {
				':serviceProviderId': serviceProviderId,
			},
		};

		try {
			const result = await docClient.scan(params).promise();
			const paymentParameters = convertToCamelCase(result.Items || []);
			return paymentParameters;
		} catch (error) {
			Sentry.captureException(error);
		}
	}

	async getProviders(): Promise<any> {
		const docClient = new DocumentClient();

		const params: DocumentClient.ScanInput = {
			TableName: 'Providers',
			FilterExpression: '#active = :active',
			ExpressionAttributeNames: {
				'#active': 'Active',
			},
			ExpressionAttributeValues: {
				':active': true,
			},
		};

		try {
			const result = await docClient.scan(params).promise();
			const providers = convertToCamelCase(result.Items || []);
			return providers;
		} catch (error) {
			Sentry.captureException(error);
		}
	}

	async validatePaymentParameterId(
		paymentId: string,
		serviceProviderId: string
	) {
		try {
			const response = await this.getPaymentsParameters(serviceProviderId);
			const parameters = response;
			const parameter = await this.filterParameterById(parameters, paymentId);
			return parameter?.id ? parameter : {};
		} catch (error) {
			Sentry.captureException(error);
		}
		return {};
	}

	async processParameterFlow(
		parameterId,
		walletAddressId,
		walletAsset,
		serviceProviderId,
		userId,
		senderUrl,
		activityId,
		itemName,
		clientId
	) {
		const parameterExists = await this.validatePaymentParameterId(
			parameterId,
			serviceProviderId
		);

		if (!parameterExists?.id) {
			this.authGateway.sendDataClientId('error', clientId, {
				message: 'The specified type parameter does not exist',
				statusCode: 'WGE0222',
			});
		}

		const incomingPayment = await this.dbIncomingUser
			.query('ServiceProviderId')
			.eq(serviceProviderId)
			.where('SenderUrl')
			.eq(senderUrl)
			.where('Status')
			.eq(true)
			.exec();

		if (!incomingPayment || incomingPayment.length === 0) {
			this.authGateway.sendDataClientId('error', clientId, {
				message: 'You don’t have any incoming payments yet.',
				statusCode: 'WGE0223',
			});
		}

		incomingPayment.sort((a: any, b: any) => b?.createdAt - a?.createdAt);

		let validIncomingPayment: any = null;

		const sendValue = adjustValue(
			calcularTotalCosto(
				parameterExists?.base,
				parameterExists?.comision,
				parameterExists?.cost,
				parameterExists?.percent,
				walletAsset?.scale
			),
			walletAsset?.scale
		);

		const sendValueWalletGuru = adjustValue(
			calcularTotalCostoWalletGuru(
				parameterExists?.base,
				parameterExists?.comision,
				parameterExists?.cost,
				parameterExists?.percent,
				walletAsset?.scale
			),
			walletAsset?.scale
		);

		for (let i = 0; i < incomingPayment.length; i++) {
			const payment = incomingPayment?.[i];
			const incomingPaymentValue = await this.getIncomingPayment(
				payment?.IncomingPaymentId
			);

			const incomingValue =
				parseInt(incomingPaymentValue?.incomingAmount?.value ?? '0') -
				parseInt(incomingPaymentValue?.receivedAmount?.value ?? '0');

			if (sendValue <= incomingValue) {
				validIncomingPayment = payment;
				break;
			}
		}

		if (!validIncomingPayment) {
			this.authGateway.sendDataClientId('error', clientId, {
				message: 'Insufficient funds',
				statusCode: 'WGE0220',
			});
		}

		if (validIncomingPayment) {
			const walletProvider = await this.findWalletByUrl(
				validIncomingPayment?.ReceiverUrl
			);

			const quoteInput = {
				walletAddressId: walletAddressId,
				receiver: validIncomingPayment?.ReceiverId,
				receiveAmount: {
					value: sendValue,
					assetCode: walletAsset?.asset ?? 'USD',
					assetScale: walletAsset?.scale ?? 2,
				},
			};

			const walletByUserId = await this.dbInstance
				.scan('UserId')
				.eq(userId)
				.attributes([
					'RafikiId',
					'PostedCredits',
					'PostedDebits',
					'PendingCredits',
					'PendingDebits',
				])
				.exec();

			const userWallet = await walletByUserId?.[0];

			const balance =
				userWallet?.PostedCredits -
				(userWallet?.PendingDebits + userWallet?.PostedDebits);

			if (quoteInput?.receiveAmount?.value > balance) {
				this.authGateway.sendDataClientId('error', clientId, {
					message: 'Insufficient funds',
					statusCode: 'WGE0220',
				});
			}

			const quote = await this.createQuote(quoteInput);
			const providerWalletId = quote?.createQuote?.quote?.receiver?.split('/');

			if (!providerWalletId) {
				this.authGateway.sendDataClientId('error', clientId, {
					message: 'Invalid quote',
					statusCode: 'WGE0221',
				});
			}

			if (providerWalletId) {
				const inputOutgoing = {
					walletAddressId: walletAddressId,
					quoteId: quote?.createQuote?.quote?.id,
					metadata: {
						activityId: activityId || '',
						contentName: itemName || '---',
						description: '',
						type: 'PROVIDER',
						wgUser: userId,
					},
				};

				const incomingState = await this.getIncomingPaymentById(
					validIncomingPayment?.IncomingPaymentId
				);

				if (incomingState?.state == 'COMPLETED') {
					this.authGateway.sendDataClientId('error', clientId, {
						message: 'Missing funds',
						statusCode: 'WGE0220',
					});
				}

				const outgoing = await this.createOutgoingPayment(inputOutgoing);

				const docClient = new DocumentClient();
				const params = {
					TableName: 'Users',
					Key: { Id: userId },
				};
				const userDynamo = await docClient.get(params).promise();

				if (userDynamo?.Item?.Grant == 1) {
					await this.createDepositOutgoingMutationService({
						outgoingPaymentId: outgoing?.createOutgoingPayment?.payment?.id,
						idempotencyKey: uuidv4(),
					});
				}

				// Send fee wg

				if (this.WALLET_WG_URL) {
					const inputReceiver = {
						metadata: {
							activityId: activityId || '',
							contentName: itemName || '---',
							description: '',
							type: 'REVENUE',
							wgUser: userId,
							serviceProviderId: walletProvider?.ProviderId,
						},
						incomingAmount: {
							value: sendValueWalletGuru,
							assetCode: walletAsset?.asset ?? 'USD',
							assetScale: walletAsset?.scale ?? 2,
						},
						walletAddressUrl: this.WALLET_WG_URL,
					};

					const receiver = await this.createReceiver(inputReceiver);
					const quoteInput = {
						walletAddressId: walletProvider?.RafikiId,
						receiver: receiver?.createReceiver?.receiver?.id,
						receiveAmount: {
							assetCode: walletAsset?.asset ?? 'USD',
							assetScale: walletAsset?.scale ?? 2,
							value: sendValueWalletGuru,
						},
					};

					setTimeout(async () => {
						const quote = await this.createQuote(quoteInput);

						const inputOutgoing = {
							walletAddressId: walletProvider?.RafikiId,
							quoteId: quote?.createQuote?.quote?.id,
							metadata: {
								activityId: activityId || '',
								contentName: itemName || '---',
								description: '',
								type: 'REVENUE',
								wgUser: userId,
								serviceProviderId: walletProvider?.ProviderId,
							},
						};
						await this.createOutgoingPayment(inputOutgoing);
					}, 500);
				}

				this.authGateway.sendDataClientId('hc', clientId, {
					message: 'Ok',
					statusCode: 'WGS0053',
					activityId: activityId,
				});
			}
		}
	}

	// async processParameterFlowUpdated(
	// 	parameterId,
	// 	walletAddressId,
	// 	walletAsset,
	// 	serviceProviderId,
	// 	userId,
	// 	senderUrl,
	// 	activityId,
	// 	itemName,
	// 	clientId
	// ) {
	// 	const parameterExists = await this.validatePaymentParameterId(
	// 		parameterId,
	// 		serviceProviderId
	// 	);

	// 	if (!parameterExists?.id) {
	// 		this.authGateway.sendDataClientId('error', clientId, {
	// 			message: 'The specified type parameter does not exist',
	// 			statusCode: 'WGE0222',
	// 		});
	// 	}

	// 	const incomingPayment = await this.dbIncomingUser
	// 		.query('ServiceProviderId')
	// 		.eq(serviceProviderId)
	// 		.where('SenderUrl')
	// 		.eq(senderUrl)
	// 		.where('Status')
	// 		.eq(true)
	// 		.exec();

	// 	if (!incomingPayment || incomingPayment.length === 0) {
	// 		this.authGateway.sendDataClientId('error', clientId, {
	// 			message: 'You don’t have any incoming payments yet.',
	// 			statusCode: 'WGE0223',
	// 		});
	// 	}

	// 	incomingPayment.sort((a: any, b: any) => b?.createdAt - a?.createdAt);

	// 	let validIncomingPayment = null;

	// 	const sendValue = adjustValue(
	// 		calcularTotalCosto(
	// 			parameterExists?.base,
	// 			parameterExists?.comision,
	// 			parameterExists?.cost,
	// 			parameterExists?.percent,
	// 			walletAsset?.scale
	// 		),
	// 		walletAsset?.scale
	// 	);

	// 	for (let i = 0; i < incomingPayment.length; i++) {
	// 		const payment = incomingPayment?.[i];
	// 		const incomingPaymentValue = await this.getIncomingPayment(
	// 			payment?.IncomingPaymentId
	// 		);

	// 		const incomingValue =
	// 			parseInt(incomingPaymentValue?.incomingAmount?.value ?? '0') -
	// 			parseInt(incomingPaymentValue?.receivedAmount?.value ?? '0');

	// 		if (sendValue <= incomingValue) {
	// 			validIncomingPayment = payment;
	// 			break;
	// 		}
	// 	}

	// 	if (!validIncomingPayment) {
	// 		this.authGateway.sendDataClientId('error', clientId, {
	// 			message: 'Insufficient funds',
	// 			statusCode: 'WGE0220',
	// 		});
	// 	}

	// 	if (validIncomingPayment) {
	// 		try {

	// 			const userWallet = await this.findWalletByUrl(
	// 				senderUrl
	// 			);

	// 		const privateKey = userWallet?.PrivateKey;
	// 		const keyId = userWallet?.KeyId;

	// 		const walletBase64 = await toBase64(privateKey);

	// 		const receiverAssetCode = 'USD';
	// 		const receiverAssetScale = 2;
	// 		const quoteDebitAmount = {
	// 			assetCode: userWalletByToken?.walletAsset?.code,
	// 			assetScale: userWalletByToken?.walletAsset?.scale,
	// 			value: adjustValue(
	// 				input?.amount,
	// 				userWalletByToken?.walletAsset?.scale
	// 			),
	// 		};
	// 		const quoteReceiveAmount = {
	// 			assetCode: userWalletByToken?.walletAsset?.code,
	// 			assetScale: userWalletByToken?.walletAsset?.scale,
	// 			value: adjustValue(
	// 				input?.amount,
	// 				userWalletByToken?.walletAsset?.scale
	// 			),
	// 		};
	// 		const expirationDate = new Date(
	// 			Date.now() + 24 * 60 * 60 * 1000
	// 		).toISOString();
	// 		const clientKey = keyId;
	// 		const clientPrivate = walletBase64;
	// 		const metadataIncoming = {
	// 			type: 'USER',
	// 			wgUser: userId,
	// 			description: '',
	// 		};
	// 		const metadataOutgoing = {
	// 			type: 'USER',
	// 			wgUser: userId,
	// 			description: '',
	// 		};

	// 			// Crear Quote
	// 			const quoteInput = {
	// 				sender: walletAddressId,
	// 				receiver: validIncomingPayment?.ReceiverId,
	// 				receiveAmount: {
	// 					value: sendValue,
	// 					assetCode: walletAsset?.asset ?? 'USD',
	// 					assetScale: walletAsset?.scale ?? 2,
	// 				},
	// 			};

	// 			const quote = await createQuote(senderUrl,validIncomingPayment?.IncomingPaymentId,req,);
	// 			console.log('Quote created:', quote);

	// 			// Validar Quote
	// 			const providerWalletId =
	// 				quote?.createQuote?.quote?.receiver?.split('/');
	// 			if (!providerWalletId) {
	// 				this.authGateway.sendDataClientId('error', clientId, {
	// 					message: 'Invalid quote',
	// 					statusCode: 'WGE0221',
	// 				});
	// 			}

	// 			// Crear Outgoing Payment
	// 			const outgoingInput = {
	// 				walletAddressId: walletAddressId,
	// 				quoteId: quote?.createQuote?.quote?.id,
	// 				metadata: {
	// 					activityId: activityId || '',
	// 					contentName: itemName || '---',
	// 					description: '',
	// 					type: 'PROVIDER',
	// 					wgUser: userId,
	// 				},
	// 			};

	// 			const outgoingPayment = await createOutgoingPayment(outgoingInput);
	// 			console.log('Outgoing Payment:', outgoingPayment);

	// 			// Actualizar estados y operaciones adicionales
	// 			const docClient = new DocumentClient();
	// 			const params = {
	// 				TableName: 'Users',
	// 				Key: { Id: userId },
	// 			};
	// 			const userDynamo = await docClient.get(params).promise();

	// 			if (userDynamo?.Item?.Grant == 1) {
	// 				await this.createDepositOutgoingMutationService({
	// 					outgoingPaymentId:
	// 						outgoingPayment?.createOutgoingPayment?.payment?.id,
	// 					idempotencyKey: uuidv4(),
	// 				});
	// 			}

	// 			this.authGateway.sendDataClientId('hc', clientId, {
	// 				message: 'Ok',
	// 				statusCode: 'WGS0053',
	// 				activityId: activityId,
	// 			});
	// 		} catch (error) {
	// 			console.error('Error processing payment:', error);
	// 			this.authGateway.sendDataClientId('error', clientId, {
	// 				message: 'Payment process failed',
	// 				statusCode: 'WGE0224',
	// 			});
	// 		}
	// 	}
	// }

	async completePayment(outgoingPaymentId, action) {
		let response;
		let data;
		const activityId = uuidv4();

		switch (action) {
			case 'accept':
				data = await this.createDepositOutgoingMutationService({
					outgoingPaymentId: outgoingPaymentId,
					idempotencyKey: activityId,
				});
				console.log('data', data);
				response = {
					action: 'hc',
					message: 'Request accepted successfully',
					statusCode: 'WGS0052',
					activityId: activityId,
				};
				break;

			case 'reject':
				data = await this.cancelOutgoingPayment({
					id: outgoingPaymentId,
					reason: 'Reject payment request',
				});
				response = {
					action: 'error',
					message: 'Reject payment request',
					statusCode: 'WGE0201',
					activityId: activityId,
				};
				break;

			case 'timeout':
				data = await this.cancelOutgoingPayment({
					id: outgoingPaymentId,
					reason: 'Timeout',
				});
				response = {
					action: 'error',
					message: 'Payment request timed out and was cancelled',
					statusCode: 'WGE0202',
					activityId: activityId,
				};
				break;

			default:
				throw new Error('Invalid action');
		}

		return response;
	}

	async getWalletByAddressRegex(walletAddress: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Wallets',
			IndexName: 'WalletAddressIndex',
			FilterExpression: 'contains(WalletAddress, :walletAddress)',
			ExpressionAttributeValues: {
				':walletAddress': walletAddress,
			},
		};

		try {
			const result = await docClient.scan(params).promise();
			return convertToCamelCase(result.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching wallet by address: ${error.message}`);
		}
	}

	async getWalletByAddress(walletAddress: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Wallets',
			IndexName: 'WalletAddressIndex',
			KeyConditionExpression: `WalletAddress  = :walletAddress`,
			ExpressionAttributeValues: {
				':walletAddress': walletAddress,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result.Items?.[0]);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching wallet by address: ${error.message}`);
		}
	}

	async getProviderCompletedTransactions(
		receiverUrl: string,
		startDate,
		endDate
	) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Transactions',
			IndexName: 'ReceiverUrlIndex',
			KeyConditionExpression: `ReceiverUrl  = :receiverUrl`,
			FilterExpression: `
			 #state = :state AND
			 #pay = :pay AND
			 #transactionDate BETWEEN :start AND :end AND
			 #type = :type
			 `,
			ExpressionAttributeNames: {
				'#state': 'State',
				'#pay': 'Pay',
				'#transactionDate': 'createdAt',
				'#type': 'Type',
			},
			ExpressionAttributeValues: {
				':state': 'COMPLETED',
				':pay': false,
				':receiverUrl': receiverUrl,
				':start': startDate,
				':end': endDate,
				':type': 'OutgoingPayment',
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result.Items);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching provider transactions: ${error.message}`);
		}
	}

	async getWalletByUser(userId: string) {
		if (userId) {
			const docClient = new DocumentClient();
			const params = {
				TableName: 'Wallets',
				IndexName: 'UserIdIndex',
				KeyConditionExpression: `UserId  = :userId`,
				ExpressionAttributeValues: {
					':userId': userId,
				},
			};

			try {
				const result = await docClient.query(params).promise();
				return convertToCamelCase(result.Items?.[0]);
			} catch (error) {
				Sentry.captureException(error);
				throw new Error(`Error fetching wallet by user: ${error.message}`);
			}
		} else {
			return {};
		}
	}

	async sendMoneyMailConfirmation(input: any, outGoingPayment: any) {
		try {
			const walletInfo = await this.getWalletByRafikyId(input.walletAddressId);
			const docClient = new DocumentClient();
			const params = {
				TableName: 'Users',
				Key: { Id: walletInfo.userId },
			};
			const result = await docClient.get(params).promise();

			const date = new Date(
				outGoingPayment.createOutgoingPayment.payment.createdAt
			);

			const day = String(date.getDate()).padStart(2, '0');
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const year = date.getFullYear();
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');

			const formattedDate = `${day}/${month}/${year} - ${hours}:${minutes}`;

			const valueFormatted = parseInt(
				outGoingPayment.createOutgoingPayment.payment.receiveAmount.value
			);
			const pow = Math.pow(
				10,
				parseInt(
					outGoingPayment.createOutgoingPayment.payment.receiveAmount.assetScale
				)
			);
			const value = {
				value: valueFormatted / pow,
				asset:
					outGoingPayment.createOutgoingPayment.payment.receiveAmount.assetCode,
				walletAddress: walletInfo.walletAddress,
				date: formattedDate,
			};

			const sqsMessage = {
				event: 'SEND_MONEY_CONFIRMATION',
				email: result.Item.Email,
				username:
					result.Item.FirstName +
					(result.Item.Lastname ? ' ' + result.Item.Lastname : ''),
				value: value,
			};

			const incomingPaymentId =
				outGoingPayment.createOutgoingPayment.payment.receiver.split('/')[4];
			const incomingPayment = await this.getIncomingPayment(incomingPaymentId);

			const receiverInfo = await this.getWalletByRafikyId(
				incomingPayment.walletAddressId
			);

			const receiverParam = {
				TableName: 'Users',
				Key: { Id: receiverInfo.userId },
			};
			const receiver = await docClient.get(receiverParam).promise();

			const receiverDate = new Date(incomingPayment.createdAt);
			const receiverDay = String(receiverDate.getDate()).padStart(2, '0');
			const receiverMonth = String(receiverDate.getMonth() + 1).padStart(
				2,
				'0'
			);
			const receiverYear = receiverDate.getFullYear();
			const receiverHours = String(receiverDate.getHours()).padStart(2, '0');
			const receiverMinutes = String(receiverDate.getMinutes()).padStart(
				2,
				'0'
			);

			const receiverDateFormatted = `${receiverDay}/${receiverMonth}/${receiverYear} - ${receiverHours}:${receiverMinutes}`;

			const valueReceiverFormatted = parseInt(
				incomingPayment.incomingAmount.value
			);
			const receiverValue = {
				value: valueReceiverFormatted / pow,
				asset: incomingPayment.incomingAmount.assetCode,
				walletAddress: walletInfo.walletAddress,
				date: receiverDateFormatted,
			};

			const sqsMsg = {
				event: 'RECEIVE_MONEY_CONFIRMATION',
				email: receiver.Item.Email,
				username:
					receiver.Item.FirstName +
					(receiver.Item.Lastname ? ' ' + receiver.Item.Lastname : ''),
				value: receiverValue,
			};

			await this.sqsService.sendMessage(process.env.SQS_QUEUE_URL, sqsMessage);
			await this.sqsService.sendMessage(process.env.SQS_QUEUE_URL, sqsMsg);
			return;
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error creating outgoing payment: ${error.message}`);
		}
	}
	async getPaymentParameters(publicKey: any) {
		try {
			const socketKeys = await this.dbInstanceSocket
				.scan('PublicKey')
				.eq(publicKey)
				.exec();
			const docClient = new DocumentClient();
			const params = {
				TableName: 'PaymentParameters',
				IndexName: 'ServiceProviderIdIndex',
				KeyConditionExpression: `ServiceProviderId = :serviceproviderid`,
				ExpressionAttributeValues: {
					':serviceproviderid': socketKeys?.[0]?.ServiceProviderId,
				},
			};
			try {
				const result = await docClient.query(params).promise();
				const results = result.Items?.map(item => ({
					serviceProviderId: item?.ServiceProviderId,
					id: item?.Id,
					active: item?.Active,
					name: item?.Name,
					interval: item?.Interval,
				}));
				return convertToCamelCase(results);
			} catch (error) {
				Sentry.captureException(error);
				throw new Error(`Error fetching wallet: ${error.message}`);
			}
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error creating deposit outoing mutation: ${error.message}`
			);
		}
	}

	async listTransactionsDynamo(token: string, search: string) {
		if (!search) {
			search = 'all';
		}

		const walletDb = await this.getUserByToken(token);
		const walletAddressId = walletDb.RafikiId;

		const transactions = await this.dbTransactions.scan().exec();

		const outgoingArray = transactions.filter(
			transaction =>
				transaction.WalletAddressId === walletAddressId &&
				transaction.Type === 'OutgoingPayment'
		);

		const incomingArray = transactions.filter(
			transaction =>
				transaction.WalletAddressId === walletAddressId &&
				transaction.Type === 'IncomingPayment'
		);

		const outgoingProcessed: any[] = outgoingArray.map(object => ({
			type: object.Type,
			outgoingPaymentId: object.OutgoingPaymentId,
			walletAddressId: object.WalletAddressId,
			state: object.State,
			metadata: object.Metadata,
			receiver: object.Receiver,
			receiveAmount: object.ReceiveAmount,
			createdAt: object.CreatedAt,
		}));

		const incomingProcessed: any[] = incomingArray.map(object => ({
			type: object.Type,
			incomingPaymentId: object.IncomingPaymentId,
			walletAddressId: object.WalletAddressId,
			state: object.State,
			incomingAmount: object.IncomingAmount,
			createdAt: object.CreatedAt,
		}));

		const combinedArray: TransactionType[] =
			incomingProcessed.concat(outgoingProcessed);

		const incomingSorted = incomingProcessed.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		const outgoingSorted = outgoingProcessed.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		const combinedSorted = combinedArray.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		if (search === 'credit') {
			return convertToCamelCase(incomingSorted);
		} else if (search === 'debit') {
			return convertToCamelCase(outgoingSorted);
		} else {
			return convertToCamelCase(combinedSorted);
		}
	}

	async getUserInfoById(userId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Users',
			Key: { Id: userId },
		};

		try {
			const result = await docClient.get(params).promise();
			return convertToCamelCase(result?.Item);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching user by userId: ${error.message}`);
		}
	}

	async getProviderById(providerId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Providers',
			Key: { Id: providerId },
		};

		try {
			const result = await docClient.get(params).promise();
			return convertToCamelCase(result?.Item);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching user by userId: ${error.message}`);
		}
	}

	async getLinkedProvidersUserById(userId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'Users',
			Key: { Id: userId },
		};

		try {
			const result = await docClient.get(params).promise();
			const linkedProviders = result?.Item?.LinkedServiceProviders;
			return convertToCamelCase(linkedProviders);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching user by userId: ${error.message}`);
		}
	}

	async unlinkServiceProviderBySessionId(sessionId: string): Promise<any> {
		const docClient = new DocumentClient();

		const scanParams = {
			TableName: 'Users',
		};

		const users = await docClient.scan(scanParams).promise();
		const usersToUpdate =
			users?.Items?.filter(user =>
				user?.LinkedServiceProviders?.some(
					provider => provider?.sessionId === sessionId
				)
			) ?? [];

		if (usersToUpdate.length === 0) {
			return {
				statusCode: HttpStatus.NOT_FOUND,
				message: 'No users found with the specified sessionId.',
			};
		}

		for (const user of usersToUpdate) {
			const linkedProviders = user?.LinkedServiceProviders ?? [];

			const updatedProviders = linkedProviders.filter(
				provider => provider?.sessionId !== sessionId
			);

			if (updatedProviders.length !== linkedProviders.length) {
				const updateParams = {
					TableName: 'Users',
					Key: { Id: user?.Id },
					UpdateExpression: 'SET LinkedServiceProviders = :updatedProviders',
					ExpressionAttributeValues: {
						':updatedProviders': updatedProviders,
					},
					ReturnValues: 'ALL_NEW',
				};

				await docClient.update(updateParams).promise();

				const incomingPaymentsProvider =
					await this.getIncomingByServiceProviderAndUserId(
						linkedProviders?.[0]?.serviceProviderId,
						user?.Id
					);

				for (let i = 0; i < incomingPaymentsProvider?.length; i++) {
					const incomingId = incomingPaymentsProvider?.[i]?.IncomingPaymentId;
					await this.cancelUserIncomingPaymentId(incomingId, user?.Id);
				}
			}
		}

		return {
			statusCode: HttpStatus.OK,
			message: 'Service provider unlinked successfully.',
		};
	}

	async updateListServiceProviders(
		id: string,
		address: string,
		sessionId: string
	): Promise<any> {
		const docClient = new DocumentClient();
		const wallet = await this.findWalletByUrl(address);
		const serviceProvider = wallet?.ProviderId;
		const user = await this.getUserInfoById(id);

		if (!user) {
			throw new Error(`User with ID ${id} not found`);
		}

		const linkedProviders: any[] = user.linkedServiceProviders ?? [];

		if (
			linkedProviders.some(
				provider => provider.serviceProviderId === serviceProvider
			)
		) {
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0210',
			};
		}

		const provider = await this.getProviderById(serviceProvider);

		const providerObject = {
			serviceProviderId: serviceProvider,
			sessionId: sessionId,
			vinculationDate: new Date().toISOString(),
			walletUrl: address,
			serviceProviderName: provider?.name,
		};

		linkedProviders.push(providerObject);

		const updateParams = {
			TableName: 'Users',
			Key: { Id: id },
			UpdateExpression: 'SET LinkedServiceProviders = :linkedProviders',
			ExpressionAttributeValues: {
				':linkedProviders': linkedProviders,
			},
			ReturnValues: 'ALL_NEW',
		};

		await docClient.update(updateParams).promise();

		const linkedProvider = {
			serviceProviderId: providerObject?.serviceProviderId,
			sessionId: providerObject?.sessionId,
			vinculationDate: providerObject?.vinculationDate,
			walletUrl: address,
			serviceProviderName: provider?.name,
		};

		return linkedProvider;
	}

	async getWalletByTokenWS(token: string): Promise<Wallet> {
		return await this.getUserByToken(token);
	}

	async generateClearPayments() {
		try {
			const providers = await this.getProviders();
			const now = new Date();

			const startDate = new Date(
				now.getFullYear(),
				now.getMonth() - 1,
				1,
				0,
				0,
				0,
				0
			);

			const endDate = new Date(
				now.getFullYear(),
				now.getMonth(),
				0,
				23,
				59,
				59,
				999
			);

			Promise.all(
				providers.map(async provider => {
					const providerWallet = await this.getWalletAddressByProviderId(
						provider?.id
					);

					const transactions = await this.getProviderCompletedTransactions(
						providerWallet?.walletAddress,
						startDate.getTime(),
						endDate.getTime()
					);

					if (transactions?.length) {
						const paymentParameters = await this.getPaymentsParameters(
							provider?.id
						);

						const transactionIds = transactions?.map(transaction => {
							return transaction?.id;
						});

						const totalAmount = transactions.reduce((total, transaction) => {
							return total + parseFloat(transaction?.receiveAmount?.value || 0);
						}, 0);

						const walletInfo = await this.graphqlService.listWalletInfo(
							providerWallet.rafikiId
						);
						const scale = walletInfo.data.walletAddress.asset.scale;
						const code = walletInfo.data.walletAddress.asset.code;
						const paymentParameter =
							paymentParameters?.find(parameter => parameter?.asset === code) ||
							paymentParameters?.[0];
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

						const createProviderRevenueDTO = {
							ServiceProviderId: provider?.id,
							Value: totalAmount,
							StartDate: startDate.getTime(),
							EndDate: endDate.getTime(),
							Fees: fees,
							TransactionIds: transactionIds,
						};
						await this.dbClearPayments.create(createProviderRevenueDTO);
					}
				})
			);
		} catch (error) {
			Sentry.captureException(error);
		}
	}

	async confirmClearPayment(
		confirmClearPayment: ConfirmClearPayment,
		clearPayment
	) {
		try {
			await this.batchUpdateTransactions(clearPayment?.transactionIds);

			const docClient = new DocumentClient();

			const clearPaymentParams = {
				TableName: 'ClearPayments',
				Key: {
					Id: clearPayment?.id,
				},
				UpdateExpression:
					'SET #referenceNumber= :referenceNumber, #observation= :observation, #state= :state',
				ExpressionAttributeNames: {
					'#referenceNumber': 'ReferenceNumber',
					'#observation': 'Observations',
					'#state': 'State',
				},
				ExpressionAttributeValues: {
					':referenceNumber': confirmClearPayment.referenceNumber,
					':observation': confirmClearPayment.observations,
					':state': true,
				},
				ReturnValues: 'ALL_NEW',
			};

			const confirmedClearPayment = await docClient
				.update(clearPaymentParams)
				.promise();
			return convertToCamelCase(confirmedClearPayment?.Attributes);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(error.message);
		}
	}

	async createRefund(createRefundsDto: CreateRefundsDto) {
		if (createRefundsDto.amount < 1) {
			throw new Error(`Error creating refunds invalid Amount`);
		}
		if (createRefundsDto.serviceProviderId) {
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			const idTest = uuidRegex.test(createRefundsDto.serviceProviderId);
			console.log(idTest);
			if (idTest === false) {
				throw new Error(`Error creating refunds invalid Service Provider Id`);
			}
		}
		const saveRefundsDto = {
			ServiceProviderId: createRefundsDto.serviceProviderId,
			Amount: createRefundsDto.amount,
			Description: createRefundsDto.description,
			ActivityId: createRefundsDto.activityId,
		};
		return convertToCamelCase(await this.dbRefunds.create(saveRefundsDto));
	}

	async getRefunds(
		serviceProviderId: string,
		page: string,
		items: string,
		startDate: string,
		endDate: string
	) {
		const pageNumber = parseInt(page, 10) || 1;
		const itemsNumber = parseInt(items, 10) || 10;

		const startTimestamp = startDate ? new Date(startDate).getTime() : null;
		const endTimestamp = endDate ? new Date(endDate).getTime() : null;

		let scan = this.dbRefunds.scan();

		if (serviceProviderId) {
			scan = scan.where('ServiceProviderId').eq(serviceProviderId);
		}

		if (startTimestamp !== null && endTimestamp !== null) {
			scan = scan.filter('CreateDate').between(startTimestamp, endTimestamp);
		} else if (startTimestamp !== null) {
			scan = scan.filter('CreateDate').ge(startTimestamp);
		} else if (endTimestamp !== null) {
			scan = scan.filter('CreateDate').le(endTimestamp);
		}

		const refundsData = await scan.exec();

		const convertedRefunds = convertToCamelCase(refundsData);

		if (!convertedRefunds.length) {
			return {
				items: [],
				totalItems: 0,
				currentPage: pageNumber,
				totalPages: 0,
			};
		}

		const startIndex = (pageNumber - 1) * itemsNumber;
		const endIndex = Math.min(
			startIndex + itemsNumber,
			convertedRefunds.length
		);

		const paginatedRefunds = convertedRefunds.slice(startIndex, endIndex);

		return {
			items: paginatedRefunds,
			totalItems: convertedRefunds.length,
			currentPage: pageNumber,
			totalPages: Math.ceil(convertedRefunds.length / itemsNumber),
		};
	}

	async getProviderRevenues(
		serviceProviderId?: string,
		createDate?: string,
		endDate?: string
	) {
		const docClient = new DocumentClient();

		try {
			const params: DocumentClient.ScanInput = {
				TableName: 'ProviderRevenues',
			};

			if (serviceProviderId || createDate || endDate) {
				params.FilterExpression = '';
				params.ExpressionAttributeValues = {};

				if (serviceProviderId) {
					params.IndexName = 'ServiceProviderIdIndex';
					params.FilterExpression += 'ServiceProviderId = :serviceProviderId';
					params.ExpressionAttributeValues[':serviceProviderId'] =
						serviceProviderId;
				}

				if (createDate) {
					params.FilterExpression +=
						(params.FilterExpression ? ' AND ' : '') +
						'CreateDate = :CreateDate';
					params.ExpressionAttributeValues[':CreateDate'] = Number(createDate);
				}

				if (endDate) {
					params.FilterExpression +=
						(params.FilterExpression ? ' AND ' : '') + 'EndDate <= :EndDate';
					params.ExpressionAttributeValues[':EndDate'] = Number(endDate);
				}
			}

			const result = await docClient.scan(params).promise();
			return result.Items.map(convertToCamelCase);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error fetching provider revenues: ${error.message}`);
		}
	}

	async getProviderInfoRevenueById(id: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'ClearPayments',
			Key: { Id: id },
		};

		try {
			const result = await docClient.get(params).promise();
			return convertToCamelCase(result?.Item);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(
				`Error fetching providerRevenues by id: ${error.message}`
			);
		}
	}
}
