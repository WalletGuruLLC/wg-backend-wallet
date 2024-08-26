import { IsString, Length, Matches } from 'class-validator';

export class CreateRoleDto {
	@IsString()
	@Length(1, 20)
	@Matches(/^[a-zA-Z\s´\-_]+$/)
	name: string;

	@IsString()
	@Length(0, 50)
	@Matches(/^[a-zA-Z\s´\-_]+$/)
	description: string;

	@IsString()
	providerId: string;
}
