import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { WalletController } from './controller/wallet.controller';
import { RoleController } from '../role/controller/role.controller';
import { WalletService } from './service/wallet.service';
import { RoleService } from '../role/service/role.service';
import { ConfigModule } from '@nestjs/config';
import { VerifyService } from '../../verify/verify.service';
import { VerifyModule } from '../../verify/verify.module';
import { UserModule } from '../user/user.module';
import { CognitoAuthGuard } from '../user/guard/cognito-auth.guard';

import { AccessControlMiddleware } from '../user/guard/access-control-guard';
import { ApolloClientService } from 'src/graphql/apollo-client.service';
import { GraphqlService } from 'src/graphql/graphql.service';
import { RafikiWalletController } from './controller/rafiki.controller';

@Module({
	imports: [ConfigModule, VerifyModule, UserModule],
	controllers: [WalletController, RafikiWalletController, RoleController],
	providers: [
		WalletService,
		VerifyService,
		RoleService,
		CognitoAuthGuard,
		ApolloClientService,
		GraphqlService,
	],
})
export class WalletModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(AccessControlMiddleware).forRoutes(WalletController);
	}
}
