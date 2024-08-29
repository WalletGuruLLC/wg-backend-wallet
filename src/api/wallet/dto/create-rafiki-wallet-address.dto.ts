import { IsString, Matches, Length } from 'class-validator';

export class CreateRafikiWalletAddressDto {
	@IsString()
	@Length(3, 20)
	@Matches(/^(?=.*[a-z])(?=.*\d)[a-z\d]+$/, {
		message:
			'Address Name must be 3-20 characters long, contain at least one letter and one number, and be entirely lowercase.',
	})
	addressName: string;

	@IsString()
	assetId: string;
}
