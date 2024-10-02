import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { WalletController } from './controller/wallet.controller';
import { WalletService } from './service/wallet.service';
import { ConfigModule } from '@nestjs/config';
import { VerifyService } from '../../verify/verify.service';
import { VerifyModule } from '../../verify/verify.module';
import { AccessControlMiddleware } from '../../verify/access-level-control';

import { ApolloClientService } from 'src/graphql/apollo-client.service';
import { GraphqlService } from 'src/graphql/graphql.service';
import { RafikiWalletController } from './controller/rafiki.controller';
import { AuthGateway } from './service/websocket';
import { WebHookController } from './controller/webhook.controller';
import { WebHookEventService } from './service/webhook-event.service';

@Module({
	imports: [ConfigModule, VerifyModule],
	controllers: [WalletController, RafikiWalletController, WebHookController],
	providers: [
		WalletService,
		VerifyService,
		ApolloClientService,
		GraphqlService,
		AuthGateway,
		WebHookEventService,
	],
})
export class WalletModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(AccessControlMiddleware).forRoutes(WalletController);
	}
}
