import { Injectable } from '@nestjs/common';
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

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;
	private cognito: AWS.CognitoIdentityServiceProvider;

	constructor() {
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
			const { search = '', page = 1, items = 10, active, walletType, walletAddress } = getWalletDto;
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

				const matchesActive = active !== undefined ? wallet.Active === active : true;
				const matchesWalletType = walletType ? wallet.WalletType === walletType : true;
				const matchesWalletAddress = walletAddress ? wallet.WalletAddress === walletAddress : true;

				return matchesSearch && matchesActive && matchesWalletType && matchesWalletAddress;
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
}
