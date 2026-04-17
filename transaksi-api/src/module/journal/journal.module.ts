
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { journalProvider } from 'src/common/entities/journal/journal.provider';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { journalDetailProvider } from 'src/common/entities/journal_detail/journal_detail.provider';
import { JournalBuyService } from './journal-buy.service';
import { JournalSaleService } from './journal-sale.service';
import { JournalStokService } from './journal-stok.service';
import { JournalArService } from './journal-ar.service';
import { JournalApService } from './journal-ap.service';
import { JournalReturnSaleService } from './journal-return-sale.service';
import { JournalReturnBuyService } from './journal-return-buy.service';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [JournalController],
  providers: [
    ...journalProvider,
    ...journalDetailProvider,
    JournalService,
    JournalSaleService,
    JournalStokService, 
    JournalBuyService,
    JournalArService,
    JournalApService,
    JournalReturnSaleService,
    JournalReturnBuyService,
  ],
  exports: [
    JournalService,
    JournalSaleService,
    JournalStokService, 
    JournalBuyService,
  ],
})
export class JournalModule { }
