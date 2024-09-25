import {
	WebSocketGateway,
	SubscribeMessage,
	WebSocketServer,
	OnGatewayInit,
	WsResponse,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WalletService } from './wallet.service';

@WebSocketGateway({ cors: true })
export class AuthGateway implements OnGatewayInit {
	@WebSocketServer() server;

	constructor(private readonly authService: WalletService) {}

	afterInit(server: any) {
		console.log('WebSocket server initialized');
	}

	@SubscribeMessage('login')
	handleLogin(client: Socket): WsResponse<string> {
		const token = this.authService.generateToken('testProviderId');
		client.emit('authenticated', { message: 'You are authenticated!', token });
		console.log(`Client ${client.id} authenticated successfully.`);
		return { event: 'response', data: 'Authentication processed.' };
	}

	@SubscribeMessage('authenticate')
	handleAuthentication(
		client: Socket,
		data: { token: string }
	): WsResponse<string> {
		const isValid = this.authService.verifyToken(data.token, 'testProviderId');
		if (isValid) {
			client.emit('authenticated', 'You are authenticated!');
			console.log(`Client ${client.id} authenticated successfully.`);
		} else {
			client.emit('unauthorized', 'Authentication failed!');
			console.log(`Client ${client.id} failed to authenticate.`);
		}
		return { event: 'response', data: 'Authentication processed.' };
	}
}
