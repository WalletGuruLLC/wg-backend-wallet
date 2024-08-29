import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Headers,
	UsePipes,
} from '@nestjs/common';

import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';
import { errorCodes, successCodes } from 'src/utils/constants';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { customValidationPipe } from '../../validation.pipe';

@ApiTags('wallet-rafiki')
@Controller('api/v1/wallets/rafiki')
@ApiBearerAuth('JWT')
export class RafikiWalletController {
	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {}

	@Post('address')
	@UsePipes(customValidationPipe('WGE0025', errorCodes.WGE0025))
	@ApiOperation({ summary: 'Create a new wallet address' })
	@ApiResponse({
		status: 201,
		description: 'Wallet Address Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid Address Name or Address Name Already in Use',
	})
	async createWalletAddress(
		@Body() createRafikiWalletAddressDto: CreateRafikiWalletAddressDto,
		@Headers() headers: MapOfStringToList
	) {
		try {
			const token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				{
					statusCode: HttpStatus.UNAUTHORIZED,
					customCode: 'WGE0021',
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const wallet = await this.walletService.createWalletAddress(
				createRafikiWalletAddressDto
			);
			return {
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0080',
				customMessage: successCodes.WGS0080?.description,
				customMessageEs: successCodes.WGS0080?.descriptionEs,
				data: { wallet },
			};
		} catch (error) {
			console.log(error); //just for testing purposes
			Sentry.captureException(error);
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0073',
						customMessage: errorCodes.WGE0073?.description,
						customMessageEs: errorCodes.WGE0073?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}
}
