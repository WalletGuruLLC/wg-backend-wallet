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
	Res,
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
	ApiQuery,
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

	@ApiOperation({ summary: 'Obtener si existe una wallet address' })
	@ApiQuery({ name: 'address', required: false, type: String })
	@Get('/exist')
	async getWalletAddressExist(@Query('address') address: string) {
		try {
			const wallet = await this.walletService.getWalletAddressExist(address);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				data: wallet,
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

	//CONTROLLER TO ADD A WALLET
	@Post('/')
	@ApiCreatedResponse({
		description: 'The Add Wallet',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	@ApiBearerAuth('JWT')
	async create(
		@Body() createWalletDto: CreateWalletDto,
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		try {
			const token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			const result = await this.walletService.create(createWalletDto);
			return res.status(HttpStatus.CREATED).send({
				statusCode: HttpStatus.CREATED,
				customCode: 'WGE0072',
				data: { wallet: result },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0073',
			});
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
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		try {
			const token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			const walletFind = await this.walletService.findOne(id);
			if (!walletFind) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0074',
				});
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
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0076',
				data: { wallet: walletCamelCase },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0087',
			});
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
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		try {
			const token = headers.authorization ?? '';
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			const walletsReturned = await this.walletService.getWallets(getWalletDto);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				data: {
					wallet: walletsReturned.paginatedWallets,
					total: walletsReturned.totalCount,
				},
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0074',
			});
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
	async toggle(@Param('id') id: string, @Res() res) {
		try {
			const wallet = await this.walletService.toggle(id);
			if (wallet.active === true) {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0088',
					data: { wallet: wallet },
				});
			} else {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0090',
					data: { wallet: wallet },
				});
			}
		} catch (error) {
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0089',
			});
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
	async listAccessLevels(@Res() res, @Param('id') walletID: string) {
		try {
			const wallet = await this.walletService.findWallet(walletID);

			const walletResponse = {
				walletDb: {
					createDate: wallet?.CreateDate,
					userId: wallet?.UserId,
					updateDate: wallet?.UpdateDate,
					id: wallet?.Id,
					name: wallet?.Name,
					walletType: wallet?.WalletType,
					walletAddress: wallet?.WalletAddress,
					active: wallet?.Active,
				},
			};

			if (!wallet) {
				return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0074',
				});
			}

			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				data: { wallet: walletResponse },
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0074',
			});
		}
	}

	// CONTROLLER TO GET ALL ROUTES
	@Get('wallet/token')
	@ApiOkResponse({
		description: 'Successfully returned wallet',
	})
	@ApiBearerAuth('JWT')
	async findWalletByToken(@Headers('authorization') token: string, @Res() res) {
		try {
			const instanceVerifier = await this.verifyService.getVerifiedFactory();
			await instanceVerifier.verify(token.toString().split(' ')[1]);
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.UNAUTHORIZED).send({
				statusCode: HttpStatus.UNAUTHORIZED,
				customCode: 'WGE0001',
			});
		}

		try {
			if (token) {
				const walletsReturned = await this.walletService.getWalletByToken(
					token
				);
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0077',
					data: {
						wallet: convertToCamelCase(walletsReturned),
					},
				});
			}
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.NOT_FOUND).send({
				statusCode: HttpStatus.NOT_FOUND,
				customCode: 'WGE0074',
			});
		}
	}
}
