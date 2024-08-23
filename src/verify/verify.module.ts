import {Module} from '@nestjs/common';
import {VerifyService} from './verify/verify.service';
import {ConfigModule} from "@nestjs/config";
import envs from "./envs";

@Module({
    imports: [ConfigModule.forRoot(
        {
            load: [envs],
        }
    )],
    providers: [VerifyService],
    exports: [VerifyService],
})
export class VerifyModule {
}
