import {
	IsNotEmpty,
	IsString,
	IsNumber,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTOs

export class IncomingAmountDTO {
	@IsString()
	@IsNotEmpty()
	assetCode: string;

	@IsNumber()
	assetScale: number;

	@IsNumber()
	value: number;
}

export class MetadataDTO {
	@IsString()
	@IsNotEmpty()
	description: string;
}

export class ReceiverInputDTO {
	@ValidateNested()
	@Type(() => MetadataDTO)
	metadata: MetadataDTO;

	@ValidateNested()
	@Type(() => IncomingAmountDTO)
	incomingAmount: IncomingAmountDTO;

	@IsString()
	@IsNotEmpty()
	walletAddressUrl: string;

	@IsString()
	@IsNotEmpty()
	walletAddressId: string;
}

export class CreateQuoteInputDTO {
	@IsString()
	@IsNotEmpty()
	walletAddressId: string;

	@IsString()
	@IsNotEmpty()
	receiver: string;
}

export class CreateOutgoingPaymentInputDTO {
	@IsString()
	@IsNotEmpty()
	walletAddressId: string;

	@IsString()
	@IsNotEmpty()
	quoteId: string;
}

export class GetOutgoingPaymentInputDTO {
	@IsString()
	@IsNotEmpty()
	id: string;
}
