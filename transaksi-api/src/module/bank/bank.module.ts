import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { bankProviders } from '../../common/entities/bank/bank.provider';
import { DatabaseModule } from '../../common/db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BankController],
  providers: [BankService, ...bankProviders],
})
export class BankModule {}