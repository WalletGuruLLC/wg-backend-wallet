import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const SocketKeySchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
			required: true,
			index: {
				global: true,
				name: 'IdIndex',
			},
		},
		PublicKey: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'PublicKeyIndex',
			},
		},
		SecretKey: {
			type: String,
			required: true,
		},
		ServiceProviderId: {
			type: String,
			required: true,
			index: {
				global: true,
				name: 'ServiceProviderIdIndex',
			},
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
