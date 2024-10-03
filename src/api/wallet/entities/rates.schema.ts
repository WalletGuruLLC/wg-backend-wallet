import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const RatesSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		Base: {
			type: String,
			index: {
				global: true,
				name: 'BaseIndex',
			},
		},
		Rates: {
			type: Object,
			default: {},
		},
		ExpirationTime: {
			type: Date,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
