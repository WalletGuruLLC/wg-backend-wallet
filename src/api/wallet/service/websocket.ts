import {
	WebSocketGateway,
	SubscribeMessage,
	WebSocketServer,
	OnGatewayInit,
	WsResponse,
	OnGatewayDisconnect,
	OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WalletService } from './wallet.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true, namespace: 'service-provider-ws' })
export class AuthGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer() server: Server;
	private logger: Logger = new Logger('MessageGateway');

	constructor(private readonly authService: WalletService) {}

	afterInit(server: any) {
		console.log('WebSocket server initialized');
	}

	async handleConnection(client: Socket, ...args: any[]) {
		const timestamp = Math.floor(new Date().getTime() / 1000);
		const headers = client.handshake.headers;
		const body = client.data.body || {};
		const publicKeyData =
			body['x-public-key']?.toString() || headers['public-key']?.toString();
		const nonceData =
			body['x-nonce']?.toString() || headers['nonce']?.toString();

		if (!publicKeyData) {
			client.emit('error', {
				message: 'Public key missing!',
				statusCode: 'WGE0151',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to provide public key.`);
			return;
		}
		const tokenPromises = [];
		for (let i = -5; i <= 5; i++) {
			tokenPromises.push(
				this.authService.generateToken(body, `${timestamp + i}`, publicKeyData)
			);
		}

		const validTokenRange = await Promise.all(tokenPromises);

		if (validTokenRange.includes(nonceData)) {
			client.emit('hc', {
				message: 'You are authenticated!',
				statusCode: 'WGS0050',
				sessionId: '',
			});
			this.logger.log(`Client ${client.id} authenticated successfully.`);
		} else {
			client.emit('error', {
				message: 'You are not authenticated!',
				statusCode: 'WGE0150',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
	}

	handleDisconnect(client: Socket) {
		this.logger.log(`Client disconnected: ${client.id}`);
	}

	@SubscribeMessage('link')
	async handleLogin(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = JSON.parse(data);
		const publicKeyData =
			parsedData['x-public-key']?.toString() ||
			headers['public-key']?.toString();
		const nonceData =
			parsedData['x-nonce']?.toString() || headers['nonce']?.toString();
		const sessionIdData = parsedData.sessionId?.toString();

		if (!publicKeyData) {
			client.emit('error', {
				message: 'Public key missing!',
				statusCode: 'WGE0151',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to provide public key.`);
			return;
		}

		if (!nonceData) {
			client.emit('error', {
				message: 'You need send auth',
				statusCode: 'WGE0151',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		if (!sessionIdData) {
			client.emit('error', {
				message: 'You need send session id',
				statusCode: 'WGE0152',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		const timestamp = Math.floor(new Date().getTime() / 1000);
		const tokenPromises = [];
		const data_aux = { ...parsedData };
		delete data_aux.nonce;
		delete data_aux['x-nonce'];
		delete data_aux['x-public-key'];
		delete data_aux['x-timestamp'];

		for (let i = -5; i <= 5; i++) {
			tokenPromises.push(
				this.authService.generateToken(
					data_aux,
					`${timestamp + i}`,
					publicKeyData
				)
			);
		}

		const validTokenRange = await Promise.all(tokenPromises);

		if (validTokenRange.includes(nonceData)) {
			this.logger.log(`Client ${client.id} authenticated successfully.`);
			setTimeout(() => {
				client.emit('hc', {
					message: 'Account linked',
					statusCode: 'WGS0051',
					sessionId: sessionIdData,
					wgUserId: '2d782139-4fa4-41f5-b1f3-b89a3a7897cc',
				});
			}, 2800);
		} else {
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		return { event: 'response', data: 'Authentication processed.' };
	}

	@SubscribeMessage('activity')
	async handlePlay(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = JSON.parse(data);
		const publicKeyData =
			parsedData['x-public-key']?.toString() ||
			headers['public-key']?.toString();
		const nonceData =
			parsedData['x-nonce']?.toString() || headers['nonce']?.toString();
		const action = parsedData.action?.toString();
		const activityId = parsedData.activityId?.toString();
		const paymentType = parsedData.paymentType?.toString();
		const wgUserId = parsedData.wgUserId?.toString();
		const objectSecret = await this.authService.getServiceProviderWihtPublicKey(
			publicKeyData
		);
		const serviceProviderId = objectSecret?.ServiceProviderId;
		const walletAddress = await this.authService.findWalletByUserId(wgUserId);
		if (!publicKeyData) {
			client.emit('error', {
				message: 'Public key missing!',
				statusCode: 'WGE0151',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to provide public key.`);
			return;
		}

		if (!nonceData) {
			client.emit('error', {
				message: 'You need send auth',
				statusCode: 'WGE0151',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(
				`Client ${client.id} failed to authenticate. in activity`
			);
		}
		if (!activityId) {
			client.emit('error', {
				message: 'You need send activity id',
				statusCode: 'WGE0152',
				sessionId: '',
			});
			client.disconnect();
			this.logger.error(
				`Client ${client.id} failed to authenticate. in activity`
			);
		}
		const data_aux = { ...parsedData };
		delete data_aux['x-nonce'];
		delete data_aux['x-public-key'];
		delete data_aux['x-timestamp'];
		const timestamp = Math.floor(new Date().getTime() / 1000);
		const tokenPromises = [];

		for (let i = -5; i <= 5; i++) {
			tokenPromises.push(
				this.authService.generateToken(
					data_aux,
					`${timestamp + i}`,
					publicKeyData
				)
			);
		}

		const validTokenRange = await Promise.all(tokenPromises);

		if (validTokenRange.includes(nonceData)) {
			if (action == 'play') {
				const responsePlay = await this.authService.processParameterFlow(
					paymentType,
					walletAddress?.walletDb,
					walletAddress?.walletAsset,
					serviceProviderId,
					wgUserId
				);
				if (responsePlay?.action == 'hc') {
					setTimeout(() => {
						client.emit('hc', {
							message: 'Ok',
							statusCode: 'WGS0053',
							activityId: activityId,
						});
					}, 2800);
				} else {
					client.emit('error', {
						message: responsePlay?.message,
						statusCode: responsePlay?.statusCode,
					});
					client.disconnect();
				}
			} else {
				setTimeout(() => {
					client.emit('hc', {
						message: 'Ok',
						statusCode: 'WGS0053',
						activityId: activityId,
					});
				}, 2800);
			}
		} else {
			client.disconnect();
			this.logger.error(
				`Client ${client.id} failed to authenticate. in activity`
			);
		}
		return { event: 'response', data: 'Stop processed.' };
	}

	@SubscribeMessage('get-payment-parameters') async getPaymentParameters(
		client: Socket,
		data: any
	): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = JSON.parse(data);
		const publicKeyData =
			parsedData['x-public-key']?.toString() ||
			headers['public-key']?.toString();
		const paymentParameters = await this.authService.getPaymentParameters(
			publicKeyData
		);
		return { event: 'get-payment-parameters', data: paymentParameters };
	}
}
