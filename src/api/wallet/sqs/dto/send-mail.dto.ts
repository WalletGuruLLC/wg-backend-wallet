export class sendMailDto {
	event: string;
	email: string;
	username: string;
	value: {
		value: number;
		asset: string;
		walletAddress: string;
		date: string;
	};
}
