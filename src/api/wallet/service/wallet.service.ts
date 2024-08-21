import { Injectable } from '@nestjs/common';
import * as dynamoose from 'dynamoose';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import { CreateWalletDto, UpdateWalletDto } from '../dto/wallet.dto';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;

	constructor() {
		this.dbInstance = dynamoose.model<Wallet>('wallets', WalletSchema);
	}

	//SERVICE TO CREATE A WALLET
	async create(createWalletDto: CreateWalletDto) {
		try {
			const result = await this.dbInstance.create(createWalletDto);
			return result;
		} catch (error) {
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
		}
	}

	// SERVICE TO FIND THE SELECTED WALLET
	async findOne(id: string): Promise<Wallet | null> {
		try {
			return await this.dbInstance.get({ id: id });
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
			return await this.dbInstance.update({
				id: id,
				name: updateWalletDto.name,
				walletAddress: updateWalletDto.walletAddress,
				walletType: updateWalletDto.walletType,
				active: updateWalletDto.active,
			});
		} catch (error) {
			throw new Error(`Error updating user: ${error.message}`);
		}
	}

	//SERVICE TO GET ALL WALLETS
	async findAll() {
		try {
			const modules = await this.dbInstance
				.scan()
				.attributes(['id', 'name', 'walletName', 'walletAddress', 'active'])
				.exec();

			console.log('modules: ', modules);
			return modules;
		} catch (error) {
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
		}
	}
}
