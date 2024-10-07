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

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private dbInstanceSocket: Model<SocketKey>;
	private dbRates: Model<Rates>;
	private readonly AUTH_MICRO_URL: string;
	private readonly DOMAIN_WALLET_URL: string;

	constructor(
		private configService: ConfigService,
		private readonly graphqlService: GraphqlService
	) {
		this.dbInstance = dynamoose.model<Wallet>('Wallets', WalletSchema);
		this.dbInstanceSocket = dynamoose.model<SocketKey>(
			'SocketKeys',
			SocketKeySchema
		);
		this.dbRates = dynamoose.model<Rates>('Rates', RatesSchema);
		this.AUTH_MICRO_URL = this.configService.get<string>('AUTH_URL');
		this.DOMAIN_WALLET_URL = this.configService.get<string>(
			'DOMAIN_WALLET_URL',
			'https://cloud-nine-wallet-backend/accounts'
		);
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
			const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*\.[^\s]{2,}$/i;
			if (!urlRegex.test(updateWalletDto.walletAddress)) {
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

			const updateWalletDtoConverted = {
				Id: id,
				Name: updateWalletDto.name.trim(),
				WalletType: updateWalletDto.walletType.trim(),
				WalletAddress: updateWalletDto.walletAddress.trim(),
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

		const transactions = await this.graphqlService.listTransactions(
			walletDb.RafikiId
		);

		let outgoingArray = [];
		let incomingArray = [];

		for (
			let index = 0;
			index < 10 &&
			index < transactions.data.walletAddress.outgoingPayments.edges.length;
			index++
		) {
			let object =
				transactions.data.walletAddress.outgoingPayments.edges[index];
			let objectConverted = {
				type: object.node.__typename,
				outgoingPaymentId: object.node.id,
				walletAddressId: object.node.walletAddressId,
				state: object.node.state,
				metadata: object.node.metadata,
				receiver: object.node.receiver,
				receiveAmount: object.node.receiveAmount,
				createdAt: object.node.createdAt,
			};
			outgoingArray.push(objectConverted);
			let incomingPaymentId = object.node.receiver.split('/')[4];
			const incomingPayment = await this.getIncomingPayment(incomingPaymentId);

			if (incomingPayment.state !== 'EXPIRED') {
				let incomingConverted = {
					type: incomingPayment.__typename,
					incomingPaymentId: incomingPayment.id,
					walletAddressId: incomingPayment.walletAddressId,
					state: incomingPayment.state,
					incomingAmount: incomingPayment.incomingAmount,
					createdAt: incomingPayment.createdAt,
				};
				incomingArray.push(incomingConverted);
			}
		}
		let combinedArray = incomingArray.concat(outgoingArray);

		let incomingSorted = incomingArray.sort(
			(a: any, b: any) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);

		let outGoingSorted = outgoingArray.sort(
			(a: any, b: any) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		let combinedSorted = combinedArray.sort(
			(a: any, b: any) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		if (search === 'credit') {
			return convertToCamelCase(incomingSorted);
		} else if (search === 'debit') {
			return convertToCamelCase(outGoingSorted);
		} else {
			return convertToCamelCase(combinedSorted);
		}
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

	async createQuote(input: any) {
		try {
			return await this.graphqlService.createQuote(input);
		} catch (error) {
			throw new Error(`Error creating quote: ${error.message}`);
		}
	}

	async createOutgoingPayment(input: any) {
		try {
			return await this.graphqlService.createOutgoingPayment(input);
		} catch (error) {
			throw new Error(`Error creating outgoing payment: ${error.message}`);
		}
	}

	async getOutgoingPayment(id: string) {
		try {
			return await this.graphqlService.getOutgoingPayment(id);
		} catch (error) {
			throw new Error(`Error fetching outgoing payment: ${error.message}`);
		}
	}

	async getIncomingPayment(id: string) {
		try {
			return await this.graphqlService.getInconmingPayment(id);
		} catch (error) {
			throw new Error(`Error fetching incoming payment: ${error.message}`);
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
		const walletInfo = await this.graphqlService.listWalletInfo(walletAddress);
		const scale = walletInfo.data.walletAddress.asset.scale;
		const amountUpdated = amount * Math.pow(10, scale);
		const walletDynamo = await this.dbInstance
			.scan('RafikiId')
			.eq(walletAddress)
			.exec();
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
		return await convertToCamelCase(db);
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
			throw new Error(`Error fetching wallet: ${error.message}`);
		}
	}
}
