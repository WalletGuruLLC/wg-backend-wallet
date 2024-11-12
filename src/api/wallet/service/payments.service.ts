import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dynamoose from 'dynamoose';
import { Model } from 'dynamoose/dist/Model';
import { WalletSchema } from '../entities/wallet.schema';
import { Wallet } from '../entities/wallet.entity';
import axios from 'axios';
import { GraphqlService } from '../../../graphql/graphql.service';
import { SocketKey } from '../entities/socket.entity';
import { SocketKeySchema } from '../entities/socket.schema';
import { Rates } from '../entities/rates.entity';
import { RatesSchema } from '../entities/rates.schema';
import { generateBackendApiSignature } from 'src/utils/helpers/signatureHelper';

@Injectable()
export class PaymentService {
	private dbInstance: Model<Wallet>;
	private dbInstanceSocket: Model<SocketKey>;
	private dbRates: Model<Rates>;
	private readonly AUTH_MICRO_URL: string;
	private readonly DOMAIN_WALLET_URL: string;
	private baseUrl = process.env.URL_BASE_OPEN_PAYMENTS;

	constructor(
		private configService: ConfigService,
		private readonly graphqlService: GraphqlService
	) {
		this.dbInstance = dynamoose.model<Wallet>('Wallets', WalletSchema);
		this.dbInstanceSocket = dynamoose.model<SocketKey>(
			'SocketKeys',
			SocketKeySchema
		);
		this.dbRates = dynamoose.model<Rates>('Rates', RatesSchema);
		this.AUTH_MICRO_URL = this.configService.get<string>('AUTH_URL');
		this.DOMAIN_WALLET_URL = this.configService.get<string>(
			'DOMAIN_WALLET_URL',
			'https://cloud-nine-wallet-backend/accounts'
		);
	}

	async postAuthPayment(clientWalletAddress: string, body: any) {
		try {
			const formattedBody = { ...body };
			if (body?.variables) {
				formattedBody.variables = JSON.parse(body?.variables);
			}
			const signature = await generateBackendApiSignature(formattedBody);
			const response = await axios.post(
				`${this.baseUrl}:4006`,
				{
					access_token: {
						access: [
							{
								type: 'incoming-payment',
								actions: ['create', 'read', 'list', 'complete'],
							},
						],
					},
					client: clientWalletAddress,
				},
				{
					headers: {
						signature: signature,
					},
				}
			);
			console.log('First request completed:', response.data);
			return response.data;
		} catch (error) {
			console.log('Error in postAuthPayment:', error.message);
		}
	}

	async createIncomingPayment(receiverWalletAddress: string) {
		try {
			const tomorrow = new Date(
				new Date().setDate(new Date().getDate() + 1)
			).toISOString();

			const response = await axios.post(
				`${this.baseUrl}:4006/incoming-payments`,
				{
					walletAddress: receiverWalletAddress,
					expiresAt: tomorrow,
					metadata: {
						description: 'Free Money!',
					},
				}
			);
			console.log('Second request completed:', response.data);
			return response.data;
		} catch (error) {
			console.error('Error in createIncomingPayment:', error.message);
			throw error;
		}
	}

	async postOutgoingPaymentAuth(
		senderWalletAddress: string,
		clientWalletAddress: string,
		debitAmount: number,
		receiveAmount: number
	) {
		try {
			const response = await axios.post(`${this.baseUrl}:3006/`, {
				access_token: {
					access: [
						{
							type: 'outgoing-payment',
							actions: ['create', 'read', 'list'],
							identifier: senderWalletAddress,
							limits: {
								debitAmount,
								receiveAmount,
							},
						},
					],
				},
				client: clientWalletAddress,
				interact: {
					start: ['redirect'],
				},
			});
			console.log('Third request completed:', response.data);
			return response.data;
		} catch (error) {
			console.error('Error in postOutgoingPaymentAuth:', error.message);
			throw error;
		}
	}

	async continueInteraction(continueId: string, interact_ref: string) {
		try {
			const response = await axios.post(
				`${this.baseUrl}:3006/continue/${continueId}`,
				{
					interact_ref: interact_ref,
				}
			);
			console.log('Fourth request completed:', response.data);
			return response.data;
		} catch (error) {
			console.error('Error in continueInteraction:', error.message);
			throw error;
		}
	}

	async createOutgoingPayment(
		senderWalletAddress: string,
		incomingPaymentUrl: string,
		debitAmount: number
	) {
		try {
			const response = await axios.post(
				`${this.baseUrl}:4000/outgoing-payments`,
				{
					walletAddress: senderWalletAddress,
					incomingPayment: incomingPaymentUrl,
					debitAmount,
					metadata: {
						description: 'Pago de prueba',
					},
				}
			);
			console.log('Fifth request completed:', response.data);
			return response.data;
		} catch (error) {
			console.error('Error in createOutgoingPayment:', error.message);
			throw error;
		}
	}

	async getOutgoingPayment(outgoingPaymentId: string) {
		try {
			const response = await axios.get(
				`${this.baseUrl}:4000/outgoing-payments/${outgoingPaymentId}`
			);
			console.log('Sixth request completed:', response.data);
			return response.data;
		} catch (error) {
			console.error('Error in getOutgoingPayment:', error.message);
			throw error;
		}
	}
}
