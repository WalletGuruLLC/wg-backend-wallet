import { IsString } from 'class-validator';

export class AttemptDto {
	@IsString()
	email: string;

	@IsString()
	section: string;

	@IsString()
	status: string;
}
