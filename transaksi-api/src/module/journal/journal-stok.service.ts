// transaksi-api/src/module/journal/journal-stok.service.ts
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JournalService } from './journal.service';

@Injectable()
export class JournalStokService {
  constructor(private readonly journalService: JournalService) {}

  // FUNGSI UNTUK STOK MASUK (STOCK IN)
  async stockIn(items: any[], userId: string, manager: EntityManager, storeUuid: string) {
    if (!items || items.length === 0) return;

    const journalItems = items.map(item => ({
        stok_product_uuid: item.productUuid,
        stok_variant_uuid: item.variantUuid || null,
        stok_unit: item.unitUuid,
        stok_qty_plus: item.qty, // <-- Menggunakan qty_plus untuk IN
    }));

    await this.journalService.createJournal('STOCK_IN', { items: journalItems }, userId, storeUuid, manager);
  }

  // FUNGSI UNTUK STOK KELUAR (STOCK OUT / BARANG RUSAK)
  async stockOut(items: any[], userId: string, manager: EntityManager, storeUuid: string) {
    if (!items || items.length === 0) return;

    const journalItems = items.map(item => ({
        stok_product_uuid: item.productUuid,
        stok_variant_uuid: item.variantUuid || null,
        stok_unit: item.unitUuid,
        stok_qty_min: item.qty, // <-- Menggunakan qty_min untuk OUT
    }));

    await this.journalService.createJournal('STOCK_OUT', { items: journalItems }, userId, storeUuid, manager);
  }
}