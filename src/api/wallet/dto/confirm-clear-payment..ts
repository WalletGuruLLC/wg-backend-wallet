import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmClearPayment {
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
