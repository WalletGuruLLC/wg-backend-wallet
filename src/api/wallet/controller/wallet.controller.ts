import {
	Body,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	Patch,
	Param,
} from '@nestjs/common';

import {
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiTags,
	ApiOkResponse,
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { errorCodes, successCodes } from 'src/utils/constants';
import { CreateWalletDto, UpdateWalletDto } from '../dto/wallet.dto';

@ApiTags('wallet')
@Controller('api/v1/wallet')
export class UserController {
	constructor(private readonly walletService: WalletService) {}

	@Post('/add')
	@ApiCreatedResponse({
		description: 'Add Wallet',
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
					result.Name
				),
				customMessageEs: successCodes.WGE0072?.descriptionEs.replace(
					'$variable',
					result.Name
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
			console.log('result', walletFind);
			if (!walletFind) {
				return {
					statusCode: HttpStatus.NOT_FOUND,
					customCode: 'WGE0002',
					customMessage: errorCodes.WGE0002?.description,
					customMessageEs: errorCodes.WGE0002?.descriptionEs,
				};
			}
			const walletUpdated = await this.walletService.findOne(id);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0020',
				customMessage: successCodes.WGE0020?.description,
				customMessageEs: successCodes.WGE0020?.descriptionEs,
				data: walletUpdated,
			};
		} catch (error) {
			throw new HttpException(
				{
					statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
					customCode: 'WGE0016',
					customMessage: errorCodes.WGE0016?.description,
					customMessageEs: errorCodes.WGE0016?.descriptionEs,
				},
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
