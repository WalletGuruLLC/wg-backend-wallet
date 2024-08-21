import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Patch,
	Param,
	Get,
} from '@nestjs/common';

import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiTags,
	ApiOkResponse,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { errorCodes, successCodes } from 'src/utils/constants';
import {
	CreateWalletDto,
	GetWalletDto,
	UpdateWalletDto,
} from '../dto/wallet.dto';

@ApiTags('wallet')
@Controller('api/v1/wallet')
export class WalletController {
	constructor(private readonly walletService: WalletService) {}

	//CONTROLLER TO ADD A WALLET
	@Post('/')
	@ApiCreatedResponse({
		description: 'The Add Wallet',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async create(@Body() createWalletDto: CreateWalletDto) {
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
				data: result,
			};
		} catch (error) {
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
	}

	// CONTROLLER TO UPDATE THE SELECTED WALLET
	@Patch('/:id')
	@ApiOkResponse({
		description: 'The record has been successfully updated.',
	})
	@ApiForbiddenResponse({ description: 'Forbidden.' })
	async update(
		@Param('id') id: string,
		@Body() updateWalletDto: UpdateWalletDto
	) {
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

			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0076',
				customMessage: successCodes.WGE0076?.description.replace(
					'$variable',
					walletUpdated.name
				),
				customMessageEs: successCodes.WGE0076?.descriptionEs.replace(
					'$variable',
					walletUpdated.name
				),
				data: walletUpdated,
			};
		} catch (error) {
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
		description: 'Successfully returned modules',
	})
	async findAll() {
		const modules = await this.walletService.findAll();
		return {
			statusCode: HttpStatus.OK,
			message: 'Successfully returned modules',
			data: modules,
		};
	}
}
