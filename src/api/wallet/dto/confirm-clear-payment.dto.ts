import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmClearPaymentDto {
	@IsString()
	@IsNotEmpty()
	clearPaymentId: string;

	@IsString()
	@IsNotEmpty()
	observations: string;

	@IsString()
	@IsNotEmpty()
	referenceNumber: string;
}
