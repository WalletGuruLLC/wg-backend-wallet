import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from '../dto/wallet.dto';
import * as Sentry from '@sentry/nestjs';
import { ApolloError } from '@apollo/client/errors';
import axios from 'axios';

import { GraphqlService } from '../../../graphql/graphql.service';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { CreateServiceProviderWalletAddressDto } from '../dto/create-rafiki-service-provider-wallet-address.dto';
import { errorCodes } from 'src/utils/constants';
import { generatePublicKeyRafiki } from 'src/utils/helpers/generatePublicKeyRafiki';
import { generateJwk } from 'src/utils/helpers/jwk';
import { tigerBeetleClient } from '../../../config/tigerBeetleClient';
import { AccountFilterFlags } from 'tigerbeetle-node';
import { convertToCamelCase } from '../../../utils/helpers/convertCamelCase';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private readonly AUTH_MICRO_URL: string;
	private readonly DOMAIN_WALLET_URL: string;

	constructor(
		private configService: ConfigService,
		private readonly graphqlService: GraphqlService
	) {
		this.dbInstance = dynamoose.model<Wallet>('Wallets', WalletSchema);
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
		return await this.dbInstance.get(id);
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
		await this.updateKeys(walletCreated?.id, pairs, keyId);
		return walletCreated;
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

	async getWalletByToken(token: string): Promise<{
		walletDb: Wallet;
		walletAsset: any;
		balance: number;
		reserved: number;
	}> {
		const walletDb = await this.getUserByToken(token);
		const walletInfo = await this.graphqlService.listWalletInfo(
			walletDb.RafikiId
		);
		if (walletDb.RafikiId) {
			delete walletDb.RafikiId;
		}
		return {
			walletDb: walletDb,
			walletAsset: walletInfo.data.walletAddress.asset,
			balance: 0,
			reserved: 0,
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
		const completedIncomingPayments = this.extractAndSortCompletedPayments(
			transactions.data.walletAddress.incomingPayments.edges,
			walletDb.Id
		);
		const completedOutgoingPayments = this.extractAndSortCompletedPayments(
			transactions.data.walletAddress.outgoingPayments.edges,
			walletDb.Id
		);

		if (search === 'credit') {
			return convertToCamelCase({
				completedIncomingPayments,
			});
		} else if (search === 'debit') {
			return convertToCamelCase({
				completedOutgoingPayments,
			});
		} else {
			return convertToCamelCase({
				completedIncomingPayments,
				completedOutgoingPayments,
			});
		}
	}

	async getUserByToken(token: string) {
		let userInfo = await axios.get(
			this.AUTH_MICRO_URL + '/api/v1/users/current-user',
			{
				headers: {
					Authorization: token,
				},
			}
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
			]) // Apenas traga estas colunas
			.exec();

		return walletByUserId[0];
	}

	extractAndSortCompletedPayments(edges: any[], walletAddressId: string) {
		return edges
			.filter(edge => edge.node.state === 'COMPLETED')
			.map(edge => {
				const node = edge.node;
				let creditAccountId: string | undefined;
				let debitAccountId: string | undefined;
				if (edge.__typename === 'IncomingPaymentEdge') {
					creditAccountId = walletAddressId;
					debitAccountId = 'EMPTY';
				} else if (edge.__typename === 'OutgoingPaymentEdge') {
					debitAccountId = walletAddressId;
					creditAccountId = 'EMPTY';
				}
				return {
					id: node.id,
					state: node.state,
					description: node.metadata?.description || '',
					value: node.receivedAmount?.value || node.debitAmount?.value || 0,
					assetCode:
						node.receivedAmount?.assetCode || node.debitAmount?.assetCode || '',
					createdAt: new Date(node.createdAt).getTime(),
					debitAccountId,
					creditAccountId,
				};
			})
			.sort((a, b) => b.createdAt - a.createdAt);
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
}
