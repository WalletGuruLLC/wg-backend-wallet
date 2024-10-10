import {
	IsNotEmpty,
	IsString,
	IsNumber,
} from 'class-validator';

export class CreatePaymentDTO {

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
