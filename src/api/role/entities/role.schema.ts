import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';

export const RoleSchema = new dynamoose.Schema(
	{
		Id: {
			type: String,
			hashKey: true,
			default: () => uuidv4(),
		},
		Name: {
			type: String,
			required: true,
			validate: v => (v as string).length <= 20,
		},
		Description: {
			type: String,
			validate: v => (v as string).length <= 50,
		},
		Active: {
			type: Boolean,
			default: true,
		},
		ProviderId: {
			type: String,
			default: 'EMPTY',
			index: {
				global: true,
				name: 'ProviderIdIndex',
			},
		},
		Modules: {
			type: Object,
			default: {},
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
