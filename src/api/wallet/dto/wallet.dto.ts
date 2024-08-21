export class CreateWalletDto {
	Name: string;
	WalletType: string;
	WalletAddress: string;
	Active: boolean;
}

export class UpdateWalletDto {
	Id?: string;
	Name?: string;
	WalletType?: string;
	WalletAddress?: string;
	Active?: boolean;
}
