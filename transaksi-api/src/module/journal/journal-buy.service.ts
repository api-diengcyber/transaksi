// transaksi-api/src/module/journal/journal-buy.service.ts
import { Injectable } from '@nestjs/common';
import { JournalService } from './journal.service';

@Injectable()
export class JournalBuyService {
  constructor(private readonly journalService: JournalService) {}

  async createBuy(details: any, userId: string, storeUuid: string) {
    return this.journalService.createJournal('BUY', details, userId, storeUuid);
  }
}