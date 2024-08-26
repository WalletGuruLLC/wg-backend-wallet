import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { RoleController } from './controller/role.controller';
import { RoleService } from './service/role.service';
import { CognitoAuthGuard } from '../user/guard/cognito-auth.guard';
import { UserModule } from '../user/user.module';
import { AccessControlMiddleware } from '../user/guard/access-control-guard';
@Module({
	imports: [ConfigModule, UserModule],
	controllers: [RoleController],
	providers: [RoleService, CognitoAuthGuard],
})
export class RoleModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(AccessControlMiddleware).forRoutes(RoleController);
	}
}
