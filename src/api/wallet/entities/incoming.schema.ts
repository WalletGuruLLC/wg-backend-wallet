import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const UserIncomingSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
		},
		ServiceProviderId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'ServiceProviderIdIndex',
			},
		},
		UserId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'UserIdIndex',
			},
		},
		IncomingPaymentId: {
			type: String,
			required: true,
		},
		Status: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: {
			createdAt: 'createdAt',
			updatedAt: 'updatedAt',
		},
	}
);
