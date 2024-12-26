import {
	Module,
	MiddlewareConsumer,
	NestModule,
	RequestMethod,
} from '@nestjs/common';
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
import { SqsService } from './sqs/sqs.service';
import { UserWsGateway } from './service/websocket-users';
import { ClearPaymentController } from './controller/clear-payment.controller';
import { PaymentService } from './service/payments.service';

@Module({
	imports: [ConfigModule, VerifyModule],
	controllers: [
		WalletController,
		RafikiWalletController,
		WebHookController,
		ClearPaymentController,
	],
	providers: [
		WalletService,
		VerifyService,
		PaymentService,
		ApolloClientService,
		GraphqlService,
		AuthGateway,
		UserWsGateway,
		WebHookEventService,
		SqsService,
	],
	exports: [WalletService],
})
export class WalletModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer
			.apply(AccessControlMiddleware)
			.exclude({ path: 'api/v1/wallets/refunds', method: RequestMethod.POST })
			.exclude({
				path: 'api/v1/wallets/get/refunds',
				method: RequestMethod.GET,
			})
			.exclude({
				path: 'api/v1/wallets/info',
				method: RequestMethod.GET,
			})
			.forRoutes(WalletController);
	}
}
