import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIncomingUserDto {
	@IsString()
	@IsNotEmpty()
	serviceProviderId: string;

	@IsString()
	@IsNotEmpty()
	userId: string;

	@IsString()
	@IsNotEmpty()
	incomingPaymentId: string;
}
