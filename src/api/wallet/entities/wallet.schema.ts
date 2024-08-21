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
			validate: (value: string) => {
				if (value.length < 4) {
					throw new Error('Name must be at least 4 characters long');
				}
				return true;
			},
		},
		WalletType: String,
		WalletAddress: {
			type: String,
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
