import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dynamoose from 'dynamoose';
import * as AWS from 'aws-sdk';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import {
	CreateWalletDto,
	UpdateWalletDto,
	GetWalletDto,
} from '../dto/wallet.dto';
import * as Sentry from '@sentry/nestjs';
import { ApolloError } from '@apollo/client/errors';
import axios from 'axios';

import { GraphqlService } from '../../../graphql/graphql.service';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { errorCodes } from 'src/utils/constants';

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
	async create(
		createWalletDto: CreateWalletDto,
		rafikiId?: string,
		userId?: string
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
				WalletAddress: createWalletDto.walletAddress,
			} as any;

			if (rafikiId) {
				createWalletDtoConverted.RafikiId = rafikiId;
			}
			if (userId) {
				createWalletDtoConverted.UserId = userId;
			}

			// Check if the WalletAddress already exists
			const existingWallets = await this.dbInstance
				.scan('WalletAddress')
				.eq(createWalletDto.walletAddress)
				.exec();

			if (existingWallets.count > 0) {
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

		const createRafikiWalletAddressInput = {
			walletAddress,
			assetId: createRafikiWalletAddressDto.assetId,
		};

		let createdRafikiWalletAddress;
		try {
			createdRafikiWalletAddress = await this.createWalletAddressGraphQL(
				createRafikiWalletAddressInput
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
		return await this.create(wallet, wallet.rafikiId, wallet.userId);
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
		createRafikiWalletAddressInput: any
	) {
		//TODO: improve remaining input values, for now some things are hardcoded
		const input = {
			assetId: createRafikiWalletAddressInput.assetId,
			url: createRafikiWalletAddressInput.walletAddress,
			publicName: 'account', //TODO: Complete username
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
		return result;
	}

	async getRafikiAssets() {
		const assets = await this.graphqlService.getAssets(null, null, null, null);
		return assets.map(asset => ({
			code: asset.code,
			id: asset.id,
		}));
	}
}
