import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const ProviderRevenuesSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		ProviderId: {
			type: String,
			index: {
				global: true,
				name: 'ProviderIdIndex',
			},
		},
		Value: {
			type: Number,
			default: 0,
		},
		TransactionIds: {
			type: Array,
			schema: [String],
		},
		StartDate: {
			type: Number,
		},
		EndDate: {
			type: Number,
		},
		Observations: {
			type: String,
			required: false,
			default: '',
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
