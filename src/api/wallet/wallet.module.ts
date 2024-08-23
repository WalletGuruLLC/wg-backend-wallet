import { Module } from '@nestjs/common';
import { WalletController } from './controller/wallet.controller';
import { WalletService } from './service/wallet.service';
import { ConfigModule } from '@nestjs/config';
import { VerifyService } from '../../verify/verify.service';
import {VerifyModule} from "../../verify/verify.module";

@Module({
	imports: [ConfigModule, VerifyModule],
	controllers: [WalletController],
	providers: [WalletService, VerifyService],
})
export class WalletModule {}
