import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { DatabaseModule } from 'src/common/db/database.module';
import { accountProviders } from 'src/common/entities/account/account.provider';

@Module({
    imports: [DatabaseModule],
    controllers: [AccountController],
    providers: [
        ...accountProviders,
        AccountService
    ],
    exports: [AccountService],
})
export class AccountModule { }