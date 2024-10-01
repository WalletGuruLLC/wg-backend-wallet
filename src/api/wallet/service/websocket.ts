import {
	WebSocketGateway,
	SubscribeMessage,
	WebSocketServer,
	OnGatewayInit,
	WsResponse, OnGatewayDisconnect, OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WalletService } from './wallet.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true, namespace: 'service-provider-ws' })
export class AuthGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() server: Server;
	private logger: Logger = new Logger('MessageGateway');

	constructor(private readonly authService: WalletService) {
	}

	afterInit(server: any) {
		console.log('WebSocket server initialized');
	}

	handleConnection(client: Socket, ...args: any[]) {
		const timestamp = Math.floor(new Date().getTime()/1000);
		// const timestamp = `${client.handshake.headers.timestamp}`;
		const headers = client.handshake.headers;
		const data = client.data.body || {};
		const token = this.authService.generateToken(data, `${timestamp}`, '1234');
		if (headers.nonce === token) {
			client.emit('hc', { message: 'You are authenticated!', statusCode: 'WGS0050', sessionId: '' });
			this.logger.log(`Client ${client.id} authenticated successfully.`);
		} else {
			client.emit('error', { message: 'You are not authenticated!', statusCode: 'WGE0150', sessionId: '' });
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
	}

	handleDisconnect(client: Socket) {
		this.logger.log(`Client disconnected: ${client.id}`);
	}

	@SubscribeMessage('link')
	handleLogin(
		client: Socket,
		data: any,
	): WsResponse<string> {
		const nonceData = JSON.parse(data).nonce?.toString();
		const sessionIdData = JSON.parse(data).sessionId?.toString();
		if (!nonceData) {
			client.emit('error', { message: 'You need send auth', statusCode: 'WGE0151', sessionId: '' });
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		if (!sessionIdData) {
			client.emit('error', { message: 'You need send session id', statusCode: 'WGE0152', sessionId: '' });
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		const timestamp = Math.floor(new Date().getTime()/1000);
		// const timestamp = `${client.handshake.headers.timestamp}`;
		const data_aux = JSON.parse(data);
		delete data_aux.nonce;
		const token = this.authService.generateToken(data_aux, `${timestamp}`, '1234');
		// this.logger.log(`Client from login ${client.id} data: ${data} timestamp: ${timestamp} nonce: ${nonceData} token: ${token}`);
		if (nonceData === token) {
			this.logger.log(`Client ${client.id} authenticated successfully.`);
			setTimeout(() => {
				client.emit('hc', { message: 'Account linked', statusCode: 'WGS0051', sessionId: sessionIdData, wgUserId: '2d782139-4fa4-41f5-b1f3-b89a3a7897cc' });
			}, 2800)
		} else {
			client.disconnect();
			this.logger.error(`Client ${client.id} failed to authenticate.`);
		}
		return { event: 'response', data: 'Authentication processed.' };
	}
}
