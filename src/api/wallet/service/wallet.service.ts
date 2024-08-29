import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
import { GraphqlService } from '../../../graphql/graphql.service';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { errorCodes } from 'src/utils/constants';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private cognito: AWS.CognitoIdentityServiceProvider;

	constructor(private readonly graphqlService: GraphqlService) {
		this.dbInstance = dynamoose.model<Wallet>('Wallets', WalletSchema);
	}

	//SERVICE TO CREATE A WALLET
	async create(createWalletDto: CreateWalletDto) {
		try {
			const createWalletDtoConverted = {
				Name: createWalletDto.name,
				WalletType: createWalletDto.walletType,
				WalletAddress: createWalletDto.walletAddress,
			};

			const createdWallet = await this.dbInstance.create(
				createWalletDtoConverted
			);
			const camelCaseWallet = {
				id: createdWallet?.Id,
				name: createdWallet?.Name,
				walletType: createdWallet?.WalletType,
				walletAddress: createdWallet?.WalletAddress,
				active: createdWallet?.Active,
			};
			return camelCaseWallet;
		} catch (error) {
			Sentry.captureException(error);
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
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
				Name: updateWalletDto.name,
				WalletType: updateWalletDto.walletType,
				WalletAddress: updateWalletDto.walletAddress,
			};

			const updateObject = Object.entries(updateWalletDtoConverted).reduce(
				(acc, [key, value]) => {
					if (value !== undefined) {
						acc[key] = value;
					}
					return acc;
				},
				{ Id: id }
			);

			return await this.dbInstance.update(updateObject);
		} catch (error) {
			Sentry.captureException(error);
			throw new Error(`Error updating user: ${error.message}`);
		}
	}

	//SERVICE TO GET ALL WALLETS
	async getWallets(getWalletDto: any) {
		try {
			const {
				search = '',
				page = 1,
				items = 10,
				active,
				walletType,
				walletAddress,
			} = getWalletDto;
			const startIndex = (page - 1) * items;

			// Fetch all wallets
			const modules = await this.dbInstance
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

			// Filter wallets based on search query, ID, and other filters
			const filteredWallets = modules.filter(wallet => {
				const matchesSearch = search
					? wallet.Name.toLowerCase().includes(search.toLowerCase()) ||
					  wallet.Id.toLowerCase().includes(search.toLowerCase())
					: true;

				const matchesActive =
					active !== undefined ? wallet.Active === active : true;
				const matchesWalletType = walletType
					? wallet.WalletType === walletType
					: true;
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

			// Sort active and inactive wallets
			const sortedActiveWallets = filteredWallets
				.filter(wallet => wallet.Active)
				.sort((a, b) => a.Name.localeCompare(b.Name));

			const sortedInactiveWallets = filteredWallets
				.filter(wallet => !wallet.Active)
				.sort((a, b) => a.Name.localeCompare(b.Name));

			// Combine active and inactive wallets
			const combinedWallets = [
				...sortedActiveWallets,
				...sortedInactiveWallets,
			];

			// Convert the combined wallets to the desired format
			const convertedWalletsArray = combinedWallets.map(wallet => ({
				id: wallet.Id,
				name: wallet.Name,
				walletType: wallet.WalletType || '',
				walletAddress: wallet.WalletAddress || '',
				active: wallet.Active || false,
			}));

			// Return paginated results
			return convertedWalletsArray.slice(startIndex, startIndex + items);
		} catch (error) {
			Sentry.captureException(error);
			console.error('Error retrieving Wallets:', error.message);
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
		createRafikiWalletAddressDto: CreateRafikiWalletAddressDto
	) {
		const walletAddress = `https://cloud-nine-wallet-backend/accounts/${createRafikiWalletAddressDto.addressName}`;

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

		// const userId = hit the /users/current-user API to get the user id
		const wallet = {
			name: 'Wallet Guru',
			walletType: 'Native',
			walletAddress: createRafikiWalletAddressInput.walletAddress,
			rafikiId:
				createdRafikiWalletAddress.creteWalletAddress?.walletAddress?.id,
			//userId,
		};

		return await this.create(wallet);
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
		//TODO: improve remaining input values, for now some things are hardcoded for reaching the US
		const input = {
			assetId: createRafikiWalletAddressInput.assetId,
			url: createRafikiWalletAddressInput.walletAddress,
			publicName: 'account',
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
}
