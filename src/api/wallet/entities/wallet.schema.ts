import * as dynamoose from 'dynamoose';
import { v4 as uuidv4 } from 'uuid';
import { HttpException, HttpStatus } from '@nestjs/common';
import { errorCodes } from '../../../utils/constants';

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
					throw new HttpException(
						{
							statusCode: HttpStatus.BAD_REQUEST,
							customCode: 'WGE0073',
							customMessage: errorCodes.WGE0073?.description,
							customMessageEs: errorCodes.WGE0073?.descriptionEs,
						},
						HttpStatus.BAD_REQUEST
					);
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
			// validate: (value: string) => {
			// 	const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;
			// 	if (!urlRegex.test(value)) {
			// 		throw new HttpException(
			// 			{
			// 				statusCode: HttpStatus.BAD_REQUEST,
			// 				customCode: 'WGE0084',
			// 				customMessage: errorCodes.WGE0084?.description,
			// 				customMessageEs: errorCodes.WGE0084?.descriptionEs,
			// 			},
			// 			HttpStatus.BAD_REQUEST
			// 		);
			// 	}
			// 	return true;
			// },
			index: {
				global: true,
				name: 'WalletAddressIndex',
			},
		},
		RafikiId: {
			type: String,
		},
		UserId: {
			type: String,
		},
		ProviderId: {
			type: String,
		},
		Active: {
			type: Boolean,
			required: true,
			default: true,
		},
		PrivateKey: {
			type: String,
		},
		PublicKey: {
			type: String,
		},
		KeyId: {
			type: String,
		},
	},
	{
		timestamps: {
			createdAt: 'CreateDate',
			updatedAt: 'UpdateDate',
		},
	}
);
