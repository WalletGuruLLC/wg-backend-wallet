import {
	WebSocketGateway,
	SubscribeMessage,
	WebSocketServer,
	OnGatewayInit,
	WsResponse,
	OnGatewayDisconnect,
	OnGatewayConnection,
} from '@nestjs/websockets';
import { forwardRef, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WalletService } from './wallet.service';
import { Logger } from '@nestjs/common';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
const docClient = new DocumentClient();

@WebSocketGateway({ cors: true, namespace: 'service-provider-ws' })
export class AuthGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer() server: Server;
	private logger: Logger = new Logger('MessageGateway');

	constructor(
		@Inject(forwardRef(() => WalletService))
		private readonly authService: WalletService
	) {}

	afterInit(server: any) {
		console.log('WebSocket server initialized');
	}

	async logToDatabase(eventType: string, data: any) {
		const params = {
			TableName: 'WebSocketEvents',
			Item: {
				eventType,
				timestamp: new Date().toISOString(),
				...data,
			},
		};

		try {
			await docClient.put(params).promise();
			this.logger.log(`Event logged: ${eventType}`);
		} catch (error) {
			this.logger.error(`Failed to log event: ${error.message}`);
		}
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
			await this.logToDatabase('authenticationFailed', { ClientId: client.id });
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
			await this.logToDatabase('connectionSuccess', {
				ClientId: client.id,
				PublicKey: publicKeyData,
			});
			this.logger.log(`Client ${client.id} authenticated successfully.`);
		} else {
			client.emit('error', {
				message: 'You are not authenticated!',
				statusCode: 'WGE0150',
				sessionId: '',
			});
			client.disconnect();
			await this.logToDatabase('authenticationFailed', {
				ClientId: client.id,
				PublicKey: publicKeyData,
			});
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
	}

	handleDisconnect(client: Socket) {
		this.logToDatabase('disconnect', { ClientId: client.id });
		this.logger.log(`Client disconnected: ${client.id}`);
	}

	@SubscribeMessage('link')
	async handleLogin(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = data;
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
			await this.logToDatabase('linkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
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
			await this.logToDatabase('linkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		if (!sessionIdData) {
			client.emit('error', {
				message: 'You need send session id',
				statusCode: 'WGE0152',
				sessionId: '',
			});
			client.disconnect();
			await this.logToDatabase('linkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
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
			// TODO: Guardar sessionId en la base de datos
			client.emit('hc', {
				message: 'Ok',
				statusCode: 'WGS0053',
				sessionId: sessionIdData,
			});
			await this.logToDatabase('linkSuccess', {
				ClientId: client.id,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
		} else {
			client.disconnect();
			await this.logToDatabase('linkFailed', {
				ClientId: client.id,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
	}

	@SubscribeMessage('activity')
	async handlePlay(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = data;
		const publicKeyData =
			parsedData['x-public-key']?.toString() ||
			headers['public-key']?.toString();
		const nonceData =
			parsedData['x-nonce']?.toString() || headers['nonce']?.toString();
		const action = parsedData.action?.toString();
		const activityId = parsedData.activityId?.toString();
		const paymentType = parsedData.paymentType?.toString();
		const wgUserId = parsedData.wgUserId?.toString();
		const contentName = parsedData.contentName?.toString();
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
			await this.logToDatabase('activityFailed', {
				MissingData: true,
				ClientId: client.id,
				ActivityId: activityId,
				Action: action,
				SubscribeMessage: 'activity',
			});
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
			await this.logToDatabase('activityFailed', {
				MissingData: true,
				ClientId: client.id,
				ActivityId: activityId,
				Action: action,
				SubscribeMessage: 'activity',
			});
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
			await this.logToDatabase('activityFailed', {
				MissingData: true,
				ClientId: client.id,
				ActivityId: activityId,
				Action: action,
				SubscribeMessage: 'activity',
			});
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
			if (action == 'charge') {
				await this.authService.processParameterFlow(
					paymentType,
					walletAddress?.walletDb,
					walletAddress?.walletAsset,
					serviceProviderId,
					wgUserId,
					walletAddress?.walletUrl,
					activityId,
					contentName
				);
				await this.logToDatabase('activityCharge', {
					ClientId: client.id,
					ActivityId: activityId,
					Action: action,
					WgUserId: wgUserId,
					ItemName: contentName,
					SubscribeMessage: 'activity',
				});
			} else if (action == 'stop' || action == 'pause' || action == 'play') {
				client.emit('hc', {
					message: 'Ok',
					statusCode: 'WGS0053',
					activityId: activityId,
				});
				await this.logToDatabase('activityAction', {
					ClientId: client.id,
					ActivityId: activityId,
					Action: action,
					WgUserId: wgUserId,
					ItemName: contentName,
					SubscribeMessage: 'activity',
				});
			}
		} else {
			client.disconnect();
			this.logger.error(
				`Client ${client.id} failed to authenticate. in activity`
			);
			await this.logToDatabase('activityFailed', {
				MissingData: true,
				ClientId: client.id,
				ActivityId: activityId,
				Action: action,
				SubscribeMessage: 'activity',
			});
		}
		// return { event: 'response', data: 'Stop processed.' };
	}

	@SubscribeMessage('unlink')
	async handleUnlink(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = data;
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
			await this.logToDatabase('unlinkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
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
			await this.logToDatabase('unlinkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
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
			await this.authService.unlinkServiceProviderBySessionId(sessionIdData);
			await this.logToDatabase('unlinkSuccess', {
				ClientId: client.id,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
		} else {
			client.disconnect();
			await this.logToDatabase('unlinkFailed', {
				ClientId: client.id,
				MissingData: true,
				SessionId: sessionIdData,
				Action: 'link',
				SubscribeMessage: 'link',
			});
			this.logger.error(
				`Client ${client.id} failed to authenticate. in activity`
			);
		}
	}

	@SubscribeMessage('get-payment-parameters') async getPaymentParameters(
		client: Socket,
		data: any
	): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const parsedData = data;
		const publicKeyData =
			parsedData['x-public-key']?.toString() ||
			headers['public-key']?.toString();
		const paymentParameters = await this.authService.getPaymentParameters(
			publicKeyData
		);
		await this.logToDatabase('getPaymentParameters', {
			ClientId: client.id,
			PublicKey: publicKeyData,
			Action: 'get-payment-parameters',
			SubscribeMessage: 'get-payment-parameters',
		});
		return { event: 'get-payment-parameters', data: paymentParameters };
	}
}
