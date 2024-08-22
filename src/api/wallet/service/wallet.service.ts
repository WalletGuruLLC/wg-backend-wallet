import { Injectable } from '@nestjs/common';
import * as dynamoose from 'dynamoose';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from '../dto/wallet.dto';
import { plainToInstance, ClassTransformOptions } from 'class-transformer';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;

	constructor() {
		this.dbInstance = dynamoose.model<Wallet>('wallets', WalletSchema);
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
			console.log(createdWallet);
			const camelCaseWallet = {
				id: createdWallet?.Id,
				name: createdWallet?.Name,
				walletType: createdWallet?.WalletType,
				walletAddress: createdWallet?.WalletAddress,
				active: createdWallet?.Active,
			};
			return camelCaseWallet;
			// return await this.adapt(createdWallet);
		} catch (error) {
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
		}
	}

	// SERVICE TO FIND THE SELECTED WALLET
	async findOne(id: string): Promise<Wallet | null> {
		try {
			return await this.dbInstance.get({ Id: id });
		} catch (error) {
			throw new Error(`Error retrieving user: ${error.message}`);
		}
	}

	//FUNCTION TO UPDATE THE SELECTED WALLET
	async update(
		id: string,
		updateWalletDto: UpdateWalletDto
	): Promise<Wallet | null> {
		try {
			const createWalletDtoConverted = {
				Id: id,
				Name: updateWalletDto.name,
				WalletType: updateWalletDto.walletType,
				WalletAddress: updateWalletDto.walletAddress,
				Active: updateWalletDto.active,
			};
			return await this.dbInstance.update(createWalletDtoConverted);
		} catch (error) {
			throw new Error(`Error updating user: ${error.message}`);
		}
	}

	//SERVICE TO GET ALL WALLETS
	async getWallets(pageNumber: number, itemsNumber: number) {
		try {
			const startIndex = (pageNumber - 1) * itemsNumber;

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

			const sortedActiveWallets = modules
				.filter(wallet => wallet.Active)
				.sort((a, b) => a.Name.localeCompare(b.Name));
			const sortedInactiveWallets = modules
				.filter(wallet => !wallet.Active)
				.sort((a, b) => a.Name.localeCompare(b.Name));

			const combinedWallets = [
				...sortedActiveWallets,
				...sortedInactiveWallets,
			];

			const convertedWalletsArray: {
				id: string;
				name: string;
				walletType: string;
				walletAddress: string;
				active: boolean;
			}[] = [];

			// Loop through each wallet in the combinedWallets array
			for (const wallet of combinedWallets) {
				const convertedWallets = {
					id: wallet.Id,
					name: wallet.Name,
					walletType: wallet.WalletType || '', // Handle undefined WalletType
					walletAddress: wallet.WalletAddress || '', // Handle undefined WalletAddress
					active: wallet.Active || false, // Handle undefined Active
				};

				convertedWalletsArray.push(convertedWallets);
			}

			return convertedWalletsArray.slice(startIndex, startIndex + itemsNumber);
		} catch (error) {
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
		}
	}
}
