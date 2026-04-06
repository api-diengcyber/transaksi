import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';

@Injectable()
export class JournalReturnSaleService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createReturnSale(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        // Generate kode dengan prefix RET_SALE
        const code = await this.journalService.generateCode('RET_SALE', storeUuid);
        
        // 1. Simpan Header Jurnal
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(JournalEntity, journal);

        const detailEntities: JournalDetailEntity[] = [];
        const dataDetails = payload.details ? payload.details : payload;

        // 2. Simpan Detail Global (Reference, Notes, dll)
        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items') return; 
          if (value === null || value === undefined || value === '') return;
  
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          if (valStr.length > 250) valStr = valStr.substring(0, 250);

          const finalKey = this.journalService.toSnakeCase ? this.journalService.toSnakeCase(key) : key;

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key: finalKey,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        // 3. Ekstrak Item Retur dan Lakukan STOCK IN (Barang kembali ke gudang)
        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            const stockItemsToAdd: any[] = [];

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];

                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                // Tambahkan ke keranjang pengembalian stok
                stockItemsToAdd.push({
                    productUuid: item.product_uuid,
                    variantUuid: item.variant_uuid,
                    unitUuid: item.unit_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    qty: Number(item.qty_return || item.qty || 1) // Kuantitas yang dikembalikan
                });

                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.journalService.toSnakeCase ? this.journalService.toSnakeCase(itemKey) : itemKey}#${index}`;
                    const valStr = typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue);
  
                    if (valStr.length > 0) {
                        detailEntities.push(manager.create(JournalDetailEntity, {
                            uuid: generateJournalDetailUuid(storeUuid),
                            key: dbKey,
                            value: valStr.length > 250 ? valStr.substring(0, 250) : valStr, 
                            journalCode: code,
                            createdBy: userId,
                        }));
                    }
                });
            }

            // Eksekusi Stock In
            if (stockItemsToAdd.length > 0) {
                await this.journalStokService.stockIn(
                    stockItemsToAdd, 
                    userId, 
                    manager,
                    storeUuid, 
                    `Retur Penjualan: ${code} (Ref: ${dataDetails.reference_journal_code || '-'})`
                );
            }
        }

        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        return { message: 'Return Sale journal created successfully', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  async getReport(storeUuid: string) {
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.code LIKE :type', { type: `%RET_SALE%` })
      .orderBy('journal.createdAt', 'DESC')
      .getMany();

    return journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      // 1. Ekstrak Pelanggan
      let memberName = detailsMap['member'] || detailsMap['member_name'] || detailsMap['customer'] || detailsMap['pelanggan'];
      if (!memberName) {
         const itemMemberKey = Object.keys(detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#')) && !k.includes('uuid'));
         if (itemMemberKey) memberName = detailsMap[itemMemberKey];
      }

      // 2. Ekstrak Rincian Barang yang Diretur
      const items: any[] = [];
      let idx = 0;
      // Mencari key seperti item_name#0, qty_return#0, dll
      while (detailsMap[`item_name#${idx}`] || detailsMap[`name#${idx}`]) {
          items.push({
              name: detailsMap[`item_name#${idx}`] || detailsMap[`name#${idx}`],
              qty: Number(detailsMap[`qty_return#${idx}`] || detailsMap[`qty#${idx}`] || 1),
              price: Number(detailsMap[`price#${idx}`] || detailsMap[`sell_price#${idx}`] || 0),
              subtotal: Number(detailsMap[`subtotal#${idx}`] || 0)
          });
          idx++;
      }

      return {
        uuid: journal.uuid,
        code: journal.code,
        date: journal.createdAt,
        type: 'RET_SALE',
        totalReturn: Number(detailsMap['grand_total'] || detailsMap['amount'] || 0),
        member: memberName || 'Pelanggan Umum',
        refCode: detailsMap['reference_journal_code'] || null, // Referensi Kode SALE asli
        notes: detailsMap['notes'] || '',
        items: items // Daftar barang retur
      };
    });
  }
}