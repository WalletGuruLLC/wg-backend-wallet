import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOtpRequestDto {
	@IsEmail()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsOptional()
	token: string;
}
