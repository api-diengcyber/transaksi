
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { journalProvider } from 'src/common/entities/journal/journal.provider';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { journalDetailProvider } from 'src/common/entities/journal_detail/journal_detail.provider';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    DatabaseModule,
    ProductModule
  ],
  controllers: [JournalController],
  providers: [
    ...journalProvider,
    ...journalDetailProvider,
    JournalService,
  ],
})
export class JournalModule {}
