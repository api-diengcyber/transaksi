// transaksi-api/src/module/journal/journal-sale.service.ts
import { Injectable } from '@nestjs/common';
import { JournalService } from './journal.service';

@Injectable()
export class JournalSaleService {
  constructor(private readonly journalService: JournalService) {}

  async createSale(details: any, userId: string, storeUuid: string) {
    return this.journalService.createJournal('SALE', details, userId, storeUuid);
  }
}