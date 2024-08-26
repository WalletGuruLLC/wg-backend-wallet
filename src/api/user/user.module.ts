import { Module } from '@nestjs/common';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { ConfigModule } from '@nestjs/config';
import { SqsService } from './sqs/sqs.service';

@Module({
	imports: [ConfigModule],
	controllers: [UserController],
	providers: [UserService, SqsService],
	exports: [UserService],
})
export class UserModule {}
