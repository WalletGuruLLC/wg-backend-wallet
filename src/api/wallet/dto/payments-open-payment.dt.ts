import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AuthOpenPaymentGrantInputDTO {
	@IsString()
	@IsNotEmpty()
	clientWalletAddress: string;
}

export class IncomingOpenPaymentDTO {
	@IsString()
	@IsNotEmpty()
	receiverWalletAddress: string;
}

export class OutgoingPaymentAuthInputDTO {
	@IsString()
	@IsNotEmpty()
	senderWalletAddress: string;

	@IsString()
	@IsNotEmpty()
	clientWalletAddress: string;

	@IsNumber()
	@IsNotEmpty()
	debitAmount: number;

	@IsNumber()
	@IsNotEmpty()
	receiveAmount: number;
}

export class OutgoingOpenPaymentDTO {
	@IsString()
	@IsNotEmpty()
	senderWalletAddress: string;

	@IsString()
	@IsNotEmpty()
	incomingPaymentUrl: string;

	@IsNumber()
	@IsNotEmpty()
	debitAmount: number;
}
