import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const ClearPaymentsSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
		},
		ServiceProviderId: {
			type: String,
			index: {
				global: true,
				name: 'ServiceProviderIdIndex',
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
		EndDate: {
			type: Number,
		},
		StartDate: {
			type: Number,
		},
		Observations: {
			type: String,
			required: false,
			default: '',
		},
		ReferenceNumber: {
			type: String,
			required: false,
			default: '',
		},
		Fees: {
			type: Number,
		},
		State: {
			type: Boolean,
			default: false,
		},
		Month: {
			type: Number,
		},
		Year: {
			type: Number,
		},
		Refunds: {
			type: Number,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
