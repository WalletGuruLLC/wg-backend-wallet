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
		},
		Rates: {
			type: Array, // Use Array to define that Rates should be an array
			schema: [
				{
					type: Object,
					schema: {
						currency: String, // Currency code
						rate: Number, // Corresponding rate
					},
				},
			],
			default: [],
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
