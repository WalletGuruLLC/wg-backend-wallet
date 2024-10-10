import {
	IsNotEmpty,
	IsString,
	IsNumber,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetadataDTO } from './payments-rafiki.dto';

export class CreatePaymentDTO {
	@ValidateNested()
	@Type(() => MetadataDTO)
	metadata: MetadataDTO;

	@IsNumber()
	@IsNotEmpty()
	incomingAmount: number;

	@IsString()
	@IsNotEmpty()
	walletAddressUrl: string;

	@IsString()
	@IsNotEmpty()
	walletAddressId: string;
}
