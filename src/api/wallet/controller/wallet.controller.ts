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
    ApiOkResponse, ApiBearerAuth,
} from '@nestjs/swagger';

import {WalletService} from '../service/wallet.service';
import {VerifyService} from '../../../verify/verify.service';
import {errorCodes, successCodes} from 'src/utils/constants';
import {
    CreateWalletDto,
    GetWalletDto,
    UpdateWalletDto,
} from '../dto/wallet.dto';
import * as Sentry from '@sentry/nestjs';
import {MapOfStringToList} from "aws-sdk/clients/apigateway";


@ApiTags('wallet')
@Controller('api/v1/wallets')
export class WalletController {
    constructor(
        private readonly walletService: WalletService,
        private readonly verifyService: VerifyService
    ) {
    }

    //CONTROLLER TO ADD A WALLET
    @Post('/')
    @ApiCreatedResponse({
        description: 'The Add Wallet',
    })
    @ApiForbiddenResponse({description: 'Forbidden.'})
    @ApiBearerAuth('JWT')
    async create(
        @Body() createWalletDto: CreateWalletDto,
        @Headers() headers: MapOfStringToList) {
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
                data: result,
            };
        } catch (error) {
            Sentry.captureException(error);
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
    @ApiBearerAuth('JWT')
    async update(
        @Param('id') id: string,
        @Body() updateWalletDto: UpdateWalletDto,
        @Headers() headers: MapOfStringToList) {
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
                data: walletCamelCase,
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
        @Headers() headers: MapOfStringToList) {
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
            const wallets = await this.walletService.getWallets(getWalletDto);
            return {
                statusCode: HttpStatus.OK,
                customCode: 'WGE0077',
                customMessage: successCodes.WGE0077?.description,
                customMessageEs: successCodes.WGE0077?.descriptionEs,
                data: wallets,
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
}
