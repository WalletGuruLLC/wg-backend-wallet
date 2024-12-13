import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const RefundsSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		Description: {
			type: String,
			required: false,
		},
		Amount: {
			type: Number,
			required: false,
		},
		ActivityId: {
			type: String,
			required: false,
		},
		ServiceProviderId: {
			type: String,
			required: false,
			index: {
				global: true,
				name: 'ServiceProviderIdIndex',
			},
		},
		WalletAddress: {
			type: String,
			required: false,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
