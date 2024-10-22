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

@WebSocketGateway({ cors: true, namespace: 'users-balance' })
export class UserWsGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer() server: Server;
	private logger: Logger = new Logger('MessageGateway');
	wsClients = [];

	constructor(private readonly authService: WalletService) {}

	afterInit(server: any) {
		console.log('WebSocket users initialized');
	}

	validateToken(token: string): boolean {
		//TODO: Implement token validation
		return true;
	}

	sendMessageForAll(message: any) {
		for (const c of this.wsClients) {
			c.client.emit('hc', message);
		}
	}

	sendBalance(wgUserId: string, balance: any) {
		for (const c of this.wsClients) {
			if (c.wgUserId === wgUserId) {
				c.client.emit('balance', balance);
			}
		}
	}

	sendTransaction(wgUserId: string, transaction: any) {
		for (const c of this.wsClients) {
			if (c.wgUserId === wgUserId) {
				c.client.emit('transacctions', transaction);
			}
		}
	}

	async handleConnection(client: Socket, ...args: any[]) {
		const headers = client.handshake.headers;
		const body = client.data.body || {};
		const token = body['x-token']?.toString() || headers['token']?.toString();
		if (!token) {
			client.emit('error', {
				message: 'Token missing!',
				statusCode: 'WGE0151',
			});
			client.disconnect();
			return;
		}

		const walletInfoToken = await this.authService.getWalletByTokenWS(token);
		let wgUserId = '';
		if (walletInfoToken) {
			const walletStringfy = JSON.stringify(walletInfoToken);
			const WalletParsed = JSON.parse(walletStringfy);
			wgUserId = WalletParsed.UserId;
		}
		if (!this.validateToken(token)) {
			client.emit('error', {
				message: 'Invalid token!',
				statusCode: 'WGE0152',
			});
			client.disconnect();
			return;
		}

		client.emit('hc', {
			message: 'You are authenticated!',
			statusCode: 'WGS0050',
		});
		this.wsClients.push({
			client: client,
			token: token,
			wgUserId: wgUserId, //TODO: set user id from database for this token
		});
	}

	handleDisconnect(client: Socket) {
		for (let i = 0; i < this.wsClients.length; i++) {
			if (this.wsClients[i].client === client) {
				this.wsClients.splice(i, 1);
				break;
			}
		}
	}

	@SubscribeMessage('balance')
	async handleBalance(client: Socket, data: any): Promise<WsResponse<string>> {
		const headers = client.handshake.headers;
		const body = client.data.body || {};
		const token = body['x-token']?.toString() || headers['token']?.toString();
		if (!token) {
			client.emit('error', {
				message: 'Token missing!',
				statusCode: 'WGE0151',
			});
			client.disconnect();
			return;
		}

		const walletInfoToken = await this.authService.getWalletByTokenWS(token);
		if (walletInfoToken) {
			const walletStringfy = JSON.stringify(walletInfoToken);
			const WalletParsed = JSON.parse(walletStringfy);

			const wgUserId = WalletParsed.UserId; //TODO: set user id from database for this token

			for (const c of this.wsClients) {
				if (c.wgUserId === wgUserId) {
					c.client.emit('balance', {
						pendingCredit: WalletParsed.PendingCredits,
						pendingDebit: WalletParsed.PendingDebits,
						postedCredit: WalletParsed.PostedCredits,
						postedDebit: WalletParsed.PostedDebits,
					});
				}
			}
		}
	}
}
