import { IsString, IsUUID } from 'class-validator';
import { CreateRafikiWalletAddressDto } from './create-rafiki-wallet-address.dto';

export class CreateServiceProviderWalletAddressDto extends CreateRafikiWalletAddressDto {
	@IsString()
	providerName: string;

	@IsString()
	@IsUUID()
	providerId: string;
}
