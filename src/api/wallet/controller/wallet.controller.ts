import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Post,
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
} from '@nestjs/swagger';

import { WalletService } from '../service/wallet.service';
import { errorCodes, successCodes } from 'src/utils/constants';
import {
	CreateWalletDto,
	GetWalletDto,
	UpdateWalletDto,
} from '../dto/wallet.dto';

import {VerifyService} from "../../../verify/verify/verify.service";

@ApiTags('wallet')
@Controller('api/v1/wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService,
                private readonly verifyService: VerifyService) {
    }

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
    @ApiForbiddenResponse({description: 'Forbidden.'})
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

            const walledCamelCase = {
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
                    walledCamelCase.name
                ),
                customMessageEs: successCodes.WGE0076?.descriptionEs.replace(
                    '$variable',
                    walledCamelCase.name
                ),
                data: walledCamelCase,
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
	async findAll(@Query('page') page?: string, @Query('items') items?: string) {
		try {
			const pageNumber = page ? parseInt(page, 10) : 1;
			const itemsNumber = items ? parseInt(items, 10) : 25;
			const wallets = await this.walletService.getWallets(
				pageNumber,
				itemsNumber
			);
			return {
				statusCode: HttpStatus.OK,
				customCode: 'WGE0077',
				customMessage: successCodes.WGE0076?.description,
				customMessageEs: successCodes.WGE0076?.descriptionEs,
				data: wallets,
			};
		} catch (error) {
			return {
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				customCode: 'WGE0078',
				customMessage: errorCodes.WGE0078?.description,
				customMessageEs: errorCodes.WGE0078?.descriptionEs
			};
		}
	}
    // CONTROLLER TO GET ALL ROUTES
    @Get()
    @ApiOkResponse({
        description: 'Successfully returned modules',
    })
    async findAll(@Query('page') page?: string, @Query('items') items?: string,
				  @Headers('Authorization') token?: string) {
        try {
            const instanceVerifier = await this.verifyService.getVerifiedFactory();
            await instanceVerifier.verify(token.split(' ')[1]);
        } catch (e) {
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
        const pageNumber = page ? parseInt(page, 10) : 1;
        const itemsNumber = items ? parseInt(items, 10) : 25;
        const wallets = await this.walletService.getWallets(
            pageNumber,
            itemsNumber
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Successfully returned modules',
            data: wallets,
        };
    }
}
