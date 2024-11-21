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
import { CreateRefundsDto } from '../dto/create-refunds.dto';

@ApiTags('wallet')
@Controller('api/v1/wallets')
export class WalletController {
	constructor(
		private readonly walletService: WalletService,
		private readonly verifyService: VerifyService
	) {}

	@ApiOperation({ summary: 'Checks if a wallet address exists' })
	@ApiQuery({ name: 'address', required: false, type: String })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Wallet address successfully verified.' })
	@ApiResponse({ status: 206, description: 'Incomplete parameters.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	@Get('/exist')
	async getWalletAddressExist(
		@Query('address') address: string,
		@Headers() headers: MapOfStringToList,
		@Res() res
	) {
		try {
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

			if (!address) {
				return res.status(HttpStatus.PARTIAL_CONTENT).send({
					statusCode: HttpStatus.PARTIAL_CONTENT,
					customCode: 'WGE0134',
				});
			}

			const wallet = await this.walletService.getWalletAddressExist(address);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: wallet == 'don’t found' ? 'WGE0074' : 'WGE0077',
				data: wallet,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0078',
			});
		}
	}

	//CONTROLLER TO ADD A WALLET
	@Post('/')
	@ApiOperation({ summary: 'Create a new wallet' })
	@ApiCreatedResponse({ description: 'Wallet successfully created.' })
	@ApiForbiddenResponse({ description: 'Forbidden access.' })
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
	@ApiOperation({ summary: 'Update an existing wallet' })
	@ApiParam({ name: 'id', description: 'Wallet ID', type: String })
	@ApiOkResponse({ description: 'Wallet successfully updated.' })
	@ApiForbiddenResponse({ description: 'Forbidden access.' })
	@ApiResponse({ status: 404, description: 'Wallet not found.' })
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

			const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*\.[^\s]{2,}$/i;
			if (
				updateWalletDto.walletAddress &&
				!urlRegex.test(updateWalletDto.walletAddress)
			) {
				return res.status(HttpStatus.NOT_FOUND).send({
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0084',
				});
			}

			if (updateWalletDto?.walletAddress) {
				const walletAddresFind = await this.walletService.findWalletByUrl(
					updateWalletDto?.walletAddress
				);
				if (walletAddresFind) {
					return res.status(HttpStatus.NOT_FOUND).send({
						statusCode: HttpStatus.NOT_FOUND,
						customCode: 'WGE0201',
					});
				}
			}

			if (updateWalletDto?.name) {
				const walletNameFind = await this.walletService.findWalletByName(
					updateWalletDto?.name
				);
				if (walletNameFind) {
					return res.status(HttpStatus.NOT_FOUND).send({
						statusCode: HttpStatus.NOT_FOUND,
						customCode: 'WGE0202',
					});
				}
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
	@ApiOperation({ summary: 'Retrieve all wallets' })
	@ApiOkResponse({
		description: 'Wallets successfully retrieved.',
		type: [GetWalletDto],
	})
	@ApiBearerAuth('JWT')
	@ApiResponse({ status: 500, description: 'Server error.' })
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
	@ApiOperation({ summary: 'Toggle the activation state of a wallet' })
	@ApiParam({ name: 'id', description: 'Wallet ID', type: String })
	@ApiResponse({
		status: 200,
		description: 'Wallet state successfully toggled.',
	})
	@ApiResponse({ status: 404, description: 'Wallet not found.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async toggle(@Param('id') id: string, @Res() res) {
		try {
			const wallet = await this.walletService.toggle(id);
			const walletValue = await this.walletService.findWallet(wallet?.id);

			const walletResponse = {
				walletDb: {
					createDate: walletValue?.CreateDate,
					userId: walletValue?.UserId,
					updateDate: walletValue?.UpdateDate,
					id: walletValue?.Id,
					name: walletValue?.Name,
					walletType: walletValue?.WalletType,
					walletAddress: walletValue?.WalletAddress,
					active: walletValue?.Active,
				},
			};

			if (wallet.active === true) {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0088',
					data: { wallet: walletResponse },
				});
			} else {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0090',
					data: { wallet: walletResponse },
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
	@ApiOperation({ summary: 'Retrieve a wallet by ID' })
	@ApiParam({ name: 'walletID', description: 'Wallet ID', type: String })
	@ApiResponse({ status: 200, description: 'Wallet successfully retrieved.' })
	@ApiResponse({ status: 404, description: 'Wallet not found.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	@Get('/:id')
	async listAccessLevels(@Res() res, @Param('id') walletID: string) {
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
	@ApiOperation({ summary: 'Retrieve a wallet using a token' })
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Wallet successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async findWalletByToken(@Headers() headers: MapOfStringToList, @Res() res) {
		const token = headers?.authorization;
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

	@Post('/refunds')
	@ApiOperation({ summary: 'Create a new wallet' })
	@ApiCreatedResponse({ description: 'Wallet successfully created.' })
	@ApiForbiddenResponse({ description: 'Forbidden access.' })
	@ApiBearerAuth('JWT')
	async createRefund(
		@Body() createRefundsDto: CreateRefundsDto,
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
			const result = await this.walletService.createRefund(createRefundsDto);
			if (result) {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0232',
					data: { refunds: result },
				});
			}
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0231',
			});
		}
	}

	@ApiOperation({ summary: 'Get refunds' })
	@ApiParam({
		name: 'serviceProviderId',
		description: 'Service Provider ID',
		type: String,
		required: false,
	})
	@ApiQuery({ name: 'page', required: false, type: String })
	@ApiQuery({ name: 'items', required: false, type: String })
	@ApiQuery({ name: 'startDate', required: false, type: String })
	@ApiQuery({ name: 'endDate', required: false, type: String })
	@ApiResponse({ status: 200, description: 'Refunds successfully retrieved.' })
	@ApiResponse({ status: 404, description: 'Refund not found.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	@ApiQuery({ name: 'serviceProviderId', required: false, type: String })
	@Get('get/refunds')
	async getRefunds(
		@Res() res,
		@Query('serviceProviderId') serviceProviderId?: string,
		@Query('page') page?: string,
		@Query('items') items?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string
	) {
		try {
			const result = await this.walletService.getRefunds(
				serviceProviderId,
				page,
				items,
				startDate,
				endDate
			);
			if (result) {
				return res.status(HttpStatus.OK).send({
					statusCode: HttpStatus.OK,
					customCode: 'WGE0234',
					data: { refunds: result },
				});
			}
		} catch (error) {
			Sentry.captureException(error);
			return res.status(HttpStatus.NOT_FOUND).send({
				statusCode: HttpStatus.NOT_FOUND,
				customCode: 'WGE0233',
			});
		}
	}

	@Get('/provider/revenues/:id?')
	@ApiOperation({ summary: 'Retrieve provider revenues' })
	@ApiParam({
		name: 'id',
		required: false,
		description: 'Provider ID (optional)',
	})
	@ApiQuery({
		name: 'createDate',
		required: false,
		type: String,
		description: 'Start date for filtering (optional, ISO format)',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'End date for filtering (optional, ISO format)',
	})
	@ApiBearerAuth('JWT')
	@ApiOkResponse({ description: 'Provider revenues successfully retrieved.' })
	@ApiResponse({ status: 401, description: 'Unauthorized access.' })
	@ApiResponse({ status: 500, description: 'Server error.' })
	async getProviderRevenues(
		@Headers() headers: MapOfStringToList,
		@Res() res,
		@Param('id') id?: string,
		@Query('createDate') createDate?: string,
		@Query('endDate') endDate?: string
	) {
		let token;
		try {
			token = headers.authorization ?? '';
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
			const providerRevenues = await this.walletService.getProviderRevenues(
				id,
				createDate,
				endDate
			);
			return res.status(HttpStatus.OK).send({
				statusCode: HttpStatus.OK,
				customCode: 'WGE0161',
				providerRevenues,
			});
		} catch (error) {
			Sentry.captureException(error);
			return res.status(500).send({
				customCode: 'WGE0163',
			});
		}
	}
}
