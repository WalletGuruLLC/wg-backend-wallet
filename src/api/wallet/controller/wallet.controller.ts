import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Put,
	Patch,
	Param,
	Get,
	Query,
	Headers,
} from '@nestjs/common';

import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiTags,
	ApiOkResponse,
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { VerifyService } from '../../../verify/verify.service';
import { errorCodes, successCodes } from 'src/utils/constants';
import {
	CreateWalletDto,
	GetWalletDto,
	UpdateWalletDto,
} from '../dto/wallet.dto';
import * as Sentry from '@sentry/nestjs';
import { MapOfStringToList } from 'aws-sdk/clients/apigateway';
import { convertToCamelCase } from 'src/utils/helpers/convertCamelCase';

@ApiTags('wallet')
@Controller('api/v1/wallets')
export class WalletController {
	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {}

	//CONTROLLER TO ADD A WALLET
	@Post('/')
	@ApiCreatedResponse({
		description: 'The Add Wallet',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	@ApiBearerAuth('JWT')
	async create(
		@Body() createWalletDto: CreateWalletDto,
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
			const result = await this.walletService.create(createWalletDto);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0072',
				customMessage: successCodes.WGE0072?.description.replace(
					'$variable',
					result.name
				),
				customMessageEs: successCodes.WGE0072?.descriptionEs.replace(
					'$variable',
					result.name
				),
				data: { wallet: result },
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

	// CONTROLLER TO UPDATE THE SELECTED WALLET
	@Put('/:id')
	@ApiOkResponse({
		description: 'The record has been successfully updated.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	@ApiBearerAuth('JWT')
	async update(
		@Param('id') id: string,
		@Body() updateWalletDto: UpdateWalletDto,
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
					customCode: 'WGE0022',
					customMessage: errorCodes.WGE0021?.description,
					customMessageEs: errorCodes.WGE0021?.descriptionEs,
				},
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			const walletFind = await this.walletService.findOne(id);
			if (!walletFind) {
				return {
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
					customMessage: errorCodes.WGE0074?.description,
					customMessageEs: errorCodes.WGE0074?.descriptionEs,
				};
			}
			const walletUpdated = await this.walletService.update(
				id,
				updateWalletDto
			);
			const walletCamelCase = {
				id: walletUpdated?.Id,
				name: walletUpdated?.Name,
				walletType: walletUpdated?.WalletType,
				walletAddress: walletUpdated?.WalletAddress,
				active: walletUpdated?.Active,
			};
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0076',
				customMessage: successCodes.WGE0076?.description.replace(
					'$variable',
					walletCamelCase.name
				),
				customMessageEs: successCodes.WGE0076?.descriptionEs.replace(
					'$variable',
					walletCamelCase.name
				),
				data: { wallet: walletCamelCase },
			};
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0075',
					customMessage: errorCodes.WGE0075?.description,
					customMessageEs: errorCodes.WGE0075?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	// CONTROLLER TO GET ALL ROUTES
	@Get()
	@ApiOkResponse({
		description: 'Successfully returned wallets',
	})
	@ApiBearerAuth('JWT')
	async findAll(
		@Query() getWalletDto: GetWalletDto,
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
			const walletsReturned = await this.walletService.getWallets(getWalletDto);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				customMessage: successCodes.WGE0077?.description,
				customMessageEs: successCodes.WGE0077?.descriptionEs,
				data: {
					wallet: walletsReturned.paginatedWallets,
					total: walletsReturned.totalCount,
				},
			};
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0078',
				customMessage: errorCodes.WGE0078?.description,
				customMessageEs: errorCodes.WGE0078?.descriptionEs,
			};
		}
	}

	// CONTROLLER TO UPDATE TOGGLE ACTIVATE/INACTIVATE WALLETS
	@Patch(':id/toggle')
	@ApiOperation({ summary: 'Toggle the active status of a wallet' })
	@ApiParam({ name: 'id', description: 'ID of the wallet', type: String })
	@ApiResponse({
		status: 200,
		description: 'Wallet status toggled successfully.',
	})
	@ApiResponse({
		status: 404,
		description: 'Wallet not found.',
	})
	async toggle(@Param('id') id: string) {
		try {
			const wallet = await this.walletService.toggle(id);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0076',
				customMessage: successCodes.WGE0076?.description,
				customMessageEs: successCodes.WGE0076?.descriptionEs,
				data: { wallet: wallet },
			};
		} catch (error) {
			if (
				error instanceof HttpException &&
				error.getStatus() === HttpStatus.INTERNAL_SERVER_ERROR
			) {
				Sentry.captureException(error);
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0075',
						customMessage: errorCodes.WGE0075?.description,
						customMessageEs: errorCodes.WGE0075?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
			throw error;
		}
	}

	// CONTROLLER GET ONE WALLET BY ID
	@ApiOperation({ summary: 'Listar una wallet por ID' })
	@ApiParam({ name: 'walletID', description: 'ID del wallet', type: String })
	@ApiResponse({
		status: 200,
		description: 'Wallet obtenida con éxito.',
	})
	@ApiResponse({ status: 404, description: 'Wallet not found' })
	@Get('/:id')
	async listAccessLevels(@Param('id') walletID: string) {
		try {
			const wallet = await this.walletService.findWallet(walletID);

			const walletResponse = {
				id: wallet?.Id,
				name: wallet?.Name,
				walletType: wallet?.WalletType,
				walletAddress: wallet?.WalletAddress,
				active: wallet?.Active,
			};

			if (!wallet) {
				throw new HttpException(
					{
						statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
						customCode: 'WGE0078',
						customMessage: errorCodes.WGE0078?.description,
						customMessageEs: errorCodes.WGE0078?.descriptionEs,
					},
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}

			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				customMessage: successCodes.WGE0077?.description,
				customMessageEs: successCodes.WGE0077?.descriptionEs,
				data: { wallet: walletResponse },
			};
		} catch (error) {
			Sentry.captureException(error);
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0078',
					customMessage: errorCodes.WGE0078?.description,
					customMessageEs: errorCodes.WGE0078?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	// CONTROLLER TO GET ALL ROUTES
	@Get('wallet/token')
	@ApiOkResponse({
		description: 'Successfully returned wallet',
	})
	@ApiBearerAuth('JWT')
	async findWalletByToken(@Headers('authorization') token: string) {
		try {
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
			if (token) {
				const walletsReturned = await this.walletService.getWalletByToken(
					token
				);
				return {
					statusCode: HttpStatus.OK,
					customCode: 'WGE0077',
					customMessage: successCodes.WGE0077?.description,
					customMessageEs: successCodes.WGE0077?.descriptionEs,
					wallet: {
						wallet: convertToCamelCase(walletsReturned),
					},
				};
			}
		} catch (error) {
			Sentry.captureException(error);
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0078',
				customMessage: errorCodes.WGE0078?.description,
				customMessageEs: errorCodes.WGE0078?.descriptionEs,
			};
		}
	}
}
