import {
	IsNotEmpty,
	IsString,
	IsNumber,
	ValidateNested,
	IsOptional,
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
	@IsNumber()
	amount: number;

	@IsString()
	@IsNotEmpty()
	walletAddressUrl: string;

	@IsString()
	@IsOptional()
	walletAddressId?: string;
}

export class LinkInputDTO {
	@IsString()
	@IsNotEmpty()
	walletAddressUrl: string;

	@IsString()
	@IsOptional()
	walletAddressId?: string;

	@IsString()
	@IsOptional()
	sessionId?: string;
}

export class UnLinkInputDTO {
	@IsString()
	@IsOptional()
	sessionId?: string;
}

export class GeneralReceiverInputDTO {
	@ValidateNested()
	@Type(() => MetadataDTO)
	metadata: MetadataDTO;

	@ValidateNested()
	@Type(() => IncomingAmountDTO)
	incomingAmount: IncomingAmountDTO;

	@IsString()
	@IsNotEmpty()
	walletAddressUrl: string;
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

export class DepositDTO {
	@IsString()
	@IsNotEmpty()
	walletAddressId: string;

	@IsString()
	@IsNotEmpty()
	amount: number;
}

export class DepositOutgoingPaymentInputDTO {
	@IsString()
	@IsNotEmpty()
	outgoingPaymentId: string;
}

export class ActionOugoingPaymentDto {
	@IsString()
	@IsNotEmpty()
	outgoingPaymentId: string;

	@IsString()
	@IsNotEmpty()
	action: string;
}
