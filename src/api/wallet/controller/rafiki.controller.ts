import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Get,
	Headers,
	UsePipes,
	Res,
	Query,
} from '@nestjs/common';

import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiBody,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';
import { errorCodes, successCodes } from 'src/utils/constants';

import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import { CreateRafikiWalletAddressDto } from '../dto/create-rafiki-wallet-address.dto';
import { CreateServiceProviderWalletAddressDto } from '../dto/create-rafiki-service-provider-wallet-address.dto';
import { customValidationPipe } from '../../validation.pipe';

@ApiTags('wallet-rafiki')
@Controller('api/v1/wallets-rafiki')
@ApiBearerAuth('JWT')
export class RafikiWalletController {
	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {}

	@Post('address')
	@UsePipes(customValidationPipe('WGE0073', errorCodes.WGE0073))
	@ApiOperation({ summary: 'Create a new wallet address' })
	@ApiBody({
		type: CreateRafikiWalletAddressDto,
		description: 'Data required to create a new wallet address',
	})
	@ApiResponse({
		status: 201,
		description: 'Wallet Address Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid Address Name or Address Name Already in Use',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async createWalletAddress(
		@Body() createRafikiWalletAddressDto: CreateRafikiWalletAddressDto,
		@Headers() headers: MapOfStringToList
	) {
		let token;
		try {
			token = headers.authorization ?? '';
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
		token = token || '';
		try {
			const wallet = await this.walletService.createWalletAddress(
				createRafikiWalletAddressDto,
				token
			);
			return {
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0080',
				customMessage: successCodes.WGS0080?.description,
				customMessageEs: successCodes.WGS0080?.descriptionEs,
				data: { wallet },
			};
		} catch (error) {
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

	@Post('service-provider-address')
	//@UsePipes(customValidationPipe('WGE0073', errorCodes.WGE0073))
	@ApiOperation({ summary: 'Create a new wallet address' })
	@ApiBody({
		type: CreateRafikiWalletAddressDto,
		description: 'Data required to create a new wallet address',
	})
	@ApiResponse({
		status: 201,
		description: 'Wallet Address Created Successfully',
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid Address Name or Address Name Already in Use',
	})
	@ApiResponse({
		status: 500,
		description: 'Internal Server Error',
	})
	async createServiceProviderWalletAddress(
		@Body()
		createServiceProviderWalletAddressDto: CreateServiceProviderWalletAddressDto,
		@Headers() headers: MapOfStringToList
	) {
		let token;
		try {
			token = headers.authorization ?? '';
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
		token = token || '';
		try {
			const wallet =
				await this.walletService.createServiceProviderWalletAddress(
					createServiceProviderWalletAddressDto
				);
			return {
				statusCode: HttpStatus.CREATED,
				customCode: 'WGS0080',
				customMessage: successCodes.WGS0080?.description,
				customMessageEs: successCodes.WGS0080?.descriptionEs,
				data: { wallet },
			};
		} catch (error) {
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

	@Get('assets')
	@ApiOperation({ summary: 'List all rafiki assets' })
	@ApiResponse({
		status: 200,
		description: successCodes.WGS0081?.description,
	})
	@ApiResponse({
		status: 500,
		description: errorCodes.WGE0083?.description,
	})
	async getRafikiAssets(@Headers() headers: MapOfStringToList) {
		let token;
		try {
			token = headers.authorization ?? '';
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
			const rafikiAssets = await this.walletService.getRafikiAssets();
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGS0081',
				customMessage: successCodes.WGS0081?.description,
				customMessageEs: successCodes.WGS0081?.descriptionEs,
				data: { rafikiAssets },
			};
		} catch (error) {
			Sentry.captureException(error);
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0083',
						customMessage: errorCodes.WGE0083?.description,
						customMessageEs: errorCodes.WGE0083?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	@Get('list-transactions')
	@ApiOperation({ summary: 'List all user transactions' })
	async listTransactions(
		@Query('search') search: string,
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		let token;
		try {
			token = headers.authorization ?? '';
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
			const transactions = await this.walletService.listTransactions(
				token,
				search
			);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGS0138',
				data: { transactions: transactions },
			});
		} catch (error) {
			Sentry.captureException(error);
			console.log('error', error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0137',
			});
		}
	}
}
