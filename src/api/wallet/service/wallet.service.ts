import { Injectable } from '@nestjs/common';
import * as dynamoose from 'dynamoose';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import { CreateWalletDto } from '../dto/wallet.dto';

@Injectable()
export class WalletService {
	private dbInstance: Model<Wallet>;

	constructor() {
		this.dbInstance = dynamoose.model<Wallet>('wallets', WalletSchema);
	}

	async create(createWalletDto: CreateWalletDto) {
		try {
			console.log('createWalletDto', createWalletDto);
			const result = await this.dbInstance.create(createWalletDto);

			return result;
		} catch (error) {
			console.error('Error creating Wallet:', error.message);
			throw new Error('Failed to create user. Please try again later.');
		}
	}

	async findOne(id: string): Promise<Wallet | null> {
		try {
			return await this.dbInstance.get({ Id: id });
		} catch (error) {
			throw new Error(`Error retrieving user: ${error.message}`);
		}
	}
}
