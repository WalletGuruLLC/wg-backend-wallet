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
import { adjustValueByCurrency } from 'src/utils/helpers/adjustValueCurrecy';
import { Transaction, TransactionType } from '../entities/transactions.entity';
import { TransactionsSchema } from '../entities/transactions.schema';
import { User } from '../entities/user.entity';
import { UserSchema } from '../entities/user.schema';
import { adjustValue } from 'src/utils/helpers/generalAdjustValue';
import { calcularTotalCosto } from 'src/utils/helpers/calcularTotalTransactionPlat';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private dbInstanceSocket: Model<SocketKey>;
	private dbIncomingUser: Model<UserIncomingPayment>;
	private dbTransactions: Model<Transaction>;
	private dbUserInstance: Model<User>;
	private dbRates: Model<Rates>;
	private dbUserIncoming: Model<UserIncomingPayment>;
	private readonly AUTH_MICRO_URL: string;
	private readonly DOMAIN_WALLET_URL: string;

	constructor(
		private configService: ConfigService,
		private readonly graphqlService: GraphqlService,
		private readonly sqsService: SqsService
	) {
		this.dbUserInstance = dynamoose.model<User>('Users', UserSchema);
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
		this.dbRates = dynamoose.model<Rates>('Rates', RatesSchema);
		this.AUTH_MICRO_URL = this.configService.get<string>('AUTH_URL');
		this.DOMAIN_WALLET_URL = this.configService.get<string>(
			'DOMAIN_WALLET_URL',
			'https://cloud-nine-wallet-backend/accounts'
		);
	}

	async createIncoming(createIncomingUserDto: CreateIncomingUserDto) {
		const createIncomingDtoConverted = {
			IncomingPaymentId: createIncomingUserDto.incomingPaymentId,
			ServiceProviderId: createIncomingUserDto.serviceProviderId,
			UserId: createIncomingUserDto.userId,
		};
		return this.dbIncomingUser.create(createIncomingDtoConverted);
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
			KeyId: keyId,
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
		const jwk = await generateJwk(pairs?.privateKey, keyId);

		try {
			createdRafikiWalletAddress = await this.createWalletAddressGraphQL(
				createRafikiWalletAddressInput,
				jwk
			);
		} catch (error) {
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

	async getWalletByToken(token: string): Promise<{
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

	async listTransactions(token: string, search: string) {
		if (!search) {
			search = 'all';
		}

		const walletDb = await this.getUserByToken(token);
		const rafikiId = walletDb.RafikiId;
		const docClient = new DocumentClient();

		const outgoingParams: DocumentClient.ScanInput = {
			TableName: 'Transactions',
			FilterExpression: '#WalletAddressId = :WalletAddressId',
			ExpressionAttributeNames: {
				'#WalletAddressId': 'WalletAddressId',
			},
			ExpressionAttributeValues: {
				':WalletAddressId': rafikiId,
			},
		};
		const dynamoOutgoingPayments = await docClient
			.scan(outgoingParams)
			.promise();

		const walletAddresses = [];
		let dynamoIncomingPayments;

		for (let index = 0; index < dynamoOutgoingPayments.Items.length; index++) {
			walletAddresses.push(dynamoOutgoingPayments.Items[index].Receiver);
		}

		const expressionAttributeValues = walletAddresses.reduce(
			(acc, url, index) => {
				acc[`:walletAddress${index}`] = url;
				return acc;
			},
			{}
		);

		const filterExpression = `#WalletAddressId IN (${walletAddresses
			.map((_, index) => `:walletAddress${index}`)
			.join(', ')})`;

		if (walletAddresses.length > 0) {
			const IncomingParams: DocumentClient.ScanInput = {
				TableName: 'Transactions',
				FilterExpression: filterExpression,
				ExpressionAttributeNames: {
					'#WalletAddressId': 'WalletAddressId',
				},
				ExpressionAttributeValues: expressionAttributeValues,
			};

			dynamoIncomingPayments = await docClient.scan(IncomingParams).promise();
		} else {
			return [];
		}

		if (search === 'credit') {
			const incomingSorted = dynamoIncomingPayments.Items.sort(
				(a: any, b: any) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
			return convertToCamelCase(incomingSorted);
		} else if (search === 'debit') {
			const outGoingSorted = dynamoOutgoingPayments.Items.sort(
				(a: any, b: any) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
			return convertToCamelCase(outGoingSorted);
		} else {
			const combinedArray = dynamoIncomingPayments.Items.concat(
				dynamoOutgoingPayments.Items
			);
			const combinedSorted = combinedArray.sort(
				(a: any, b: any) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
			return convertToCamelCase(combinedSorted);
		}
	}

	async listIncomingPayments(token: string) {
		const userWallet = await this.getUserByToken(token);

		const userIncomingPayment = await this.getIncomingPaymentsByUser(
			userWallet?.UserId
		);

		const incomingPayments = [];

		await Promise.all(
			userIncomingPayment.map(async userIncomingPayment => {
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
					incomingPayment.state !== 'COMPLETED' ||
					incomingPayment.state !== 'EXPIRED'
				) {
					const incomingConverted = {
						type: incomingPayment.__typename,
						id: incomingPayment.id,
						provider: provider.name,
						ownerUser: `${user?.firstName} ${user?.lastName}`,
						state: incomingPayment.state,
						incomingAmount: incomingPayment.incomingAmount,
						createdAt: incomingPayment.createdAt,
						expiresAt: incomingPayment?.expiresAt,
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

	async createReceiver(input: any) {
		try {
			return await this.graphqlService.createReceiver(input);
		} catch (error) {
			throw new Error(`Error creating receiver: ${error.message}`);
		}
	}

	async expireDate() {
		const fechaActual = new Date();
		fechaActual.setMonth(fechaActual.getMonth() + 1);
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
					customCode: 'WGE0137',
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
			};

			await this.dbTransactions.create({
				Type: 'IncomingPayment',
				IncomingPaymentId: incomingPaymentId,
				WalletAddressId: incomingPayment?.createReceiver?.receiver?.id,
				State: incomingPayment?.createReceiver?.receiver?.state ?? 'PENDING',
				IncomingAmount: {
					_Typename: 'Amount',
					value:
						incomingPayment?.createReceiver?.receiver?.incomingAmount?.value,
					assetCode:
						incomingPayment?.createReceiver?.receiver?.incomingAmount
							?.assetCode,
					assetScale:
						incomingPayment?.createReceiver?.receiver?.incomingAmount
							?.assetScale,
				},
				Description: '',
			});

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
				const pendingDebits: number =
					(userWallet?.pendingDebits || 0) -
					parseInt(incomingPayment.incomingAmount.value);

				const params = {
					Key: {
						Id: userWallet.id,
					},
					TableName: 'Wallets',
					UpdateExpression:
						'SET PostedDebits = :postedDebits, PendingDebits = :pendingDebits',
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

				const incomingCancelResponse = await this.cancelIncomingPayment(
					incomingPaymentId
				);

				await docClient.update(params).promise();
				await docClient.update(userIncomingParams).promise();
				return incomingCancelResponse;
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

	async getIncomingPaymentsByUser(userId: string) {
		const docClient = new DocumentClient();
		const params = {
			TableName: 'UserIncoming',
			IndexName: 'UserIdIndex',
			KeyConditionExpression: `UserId = :userId`,
			FilterExpression: '#status = :status',
			ExpressionAttributeNames: {
				'#status': 'Status',
			},
			ExpressionAttributeValues: {
				':userId': userId,
				':status': true,
			},
		};

		try {
			const result = await docClient.query(params).promise();
			return convertToCamelCase(result?.Items);
		} catch (error) {
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
		userId
	) {
		const parameterExists = await this.validatePaymentParameterId(
			parameterId,
			serviceProviderId
		);

		if (!parameterExists?.id) {
			return {
				action: 'error',
				message: 'Type parameter does not exist',
				statusCode: 'WGE0203',
			};
		}

		const incomingPayment = await this.dbIncomingUser
			.scan('ServiceProviderId')
			.eq(serviceProviderId)
			.exec();

		const quoteInput = {
			walletAddressId: walletAddressId,
			receiver: incomingPayment?.[0]?.ReceiverId,
			receiveAmount: {
				value: adjustValueByCurrency(
					calcularTotalCosto(
						parameterExists?.base,
						parameterExists?.comision,
						parameterExists?.cost,
						parameterExists?.percent
					),
					walletAsset?.code ?? 'USD'
				),
				assetCode: walletAsset?.asset ?? 'USD',
				assetScale: walletAsset?.scale ?? 2,
			},
		};

		const quote = await this.createQuote(quoteInput);

		const incomingState = await this.getIncomingPaymentById(
			incomingPayment?.[0]?.IncomingPaymentId
		);

		if (incomingState?.state == 'COMPLETED') {
			return {
				action: 'error',
				message: 'Missing funds',
				statusCode: 'WGE0205',
			};
		}

		const inputOutgoing = {
			walletAddressId: walletAddressId,
			quoteId: quote?.createQuote?.quote?.id,
			metadata: {
				description: '',
				type: 'PROVIDER',
				wgUser: userId,
			},
		};

		const outgoing = await this.createOutgoingPayment(inputOutgoing);

		await this.dbTransactions.create({
			Type: 'OutgoingPayment',
			OutgoingPaymentId: outgoing?.createOutgoingPayment?.payment?.id,
			WalletAddressId:
				outgoing?.createOutgoingPayment?.payment?.walletAddressId,
			State: outgoing?.createOutgoingPayment?.payment?.state,
			Metadata: outgoing?.createOutgoingPayment?.payment?.metadata,
			Receiver: outgoing?.createOutgoingPayment?.payment?.receiver,
			ReceiveAmount: {
				_Typename: 'Amount',
				value: outgoing?.createOutgoingPayment?.payment?.receiveAmount?.value,
				assetCode:
					outgoing?.createOutgoingPayment?.payment?.receiveAmount?.assetCode,
				assetScale:
					outgoing?.createOutgoingPayment?.payment?.receiveAmount?.assetScale,
			},
			Description: '',
		});

		return {
			action: 'hc',
			message: 'Success create outgoing payment id',
			statusCode: 'WGE0206',
			data: outgoing?.createOutgoingPayment?.payment?.id,
		};
	}

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

	async getWalletByUser(userId: string) {
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
				walletAddress: receiverInfo.walletAddress,
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
					':serviceproviderid': socketKeys[0].ServiceProviderId,
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
}
