import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const WalletSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		Name: {
			type: String,
			required: true,
			validate: (value: string) => {
				if (value.length < 4) {
					throw new Error('Name must be at least 4 characters long');
				}
				return true;
			},
		},
		WalletType: {
			type: String,
			required: true,
		},
		WalletAddress: {
			type: String,
			required: true,
			validate: (value: string) => {
				const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
				if (!urlRegex.test(value)) {
					throw new Error('WalletAddress must be a valid URL');
				}
				return true;
			},
		},
		Active: {
			type: Boolean,
			required: true,
			default: true,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
