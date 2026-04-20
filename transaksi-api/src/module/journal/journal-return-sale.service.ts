import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateJournalUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
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
        // Generate kode dengan prefix RET_SALE
        const code = await this.journalService.generateCode('RET_SALE', storeUuid);
        
        // 1. Simpan Header Jurnal
        const journal = manager.create(JournalEntity, {
          uuid: generateJournalUuid(storeUuid),
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

  async getReport(storeUuid: string, queryParams?: any) {
    const { page = 1, limit = 15, search = '', startDate, endDate } = queryParams || {};

    // 1. Query builder untuk mengambil jurnal RET_SALE
    const qb = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.code LIKE :ret', { ret: `%RET_SALE%` });
    
    // 2. Filter Tanggal
    if (startDate && endDate) {
       qb.andWhere('journal.createdAt BETWEEN :startDate AND :endDate', { 
           startDate: `${startDate} 00:00:00`, 
           endDate: `${endDate} 23:59:59` 
       });
    }

    const journals = await qb.orderBy('journal.createdAt', 'DESC').getMany();

    // 3. Format details ke object map
    const formattedJournals = journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return { ...journal, detailsMap };
    });

    // 4. Proses Ekstraksi Data
    const allReturns = formattedJournals.map(ret => {
      // Ekstrak Member / Pelanggan
      let memberName = ret.detailsMap['member'] || ret.detailsMap['member_name'] || ret.detailsMap['customer'] || ret.detailsMap['pelanggan'];
      let memberUuid = ret.detailsMap['member_uuid'] || ret.detailsMap['customer_uuid'];
      
      if (!memberName) {
         const itemMemberKey = Object.keys(ret.detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid'));
         if (itemMemberKey) memberName = ret.detailsMap[itemMemberKey];
      }

      // Ekstrak Items Retur
      const items: any[] = [];
      let idx = 0;
      while (ret.detailsMap[`item_name#${idx}`] || ret.detailsMap[`product_name#${idx}`] || ret.detailsMap[`name#${idx}`]) {
          items.push({
              name: ret.detailsMap[`item_name#${idx}`] || ret.detailsMap[`product_name#${idx}`] || ret.detailsMap[`name#${idx}`],
              qty: Number(ret.detailsMap[`qty#${idx}`] || 1),
              price: Number(ret.detailsMap[`sell_price#${idx}`] || ret.detailsMap[`price#${idx}`] || 0),
              subtotal: Number(ret.detailsMap[`subtotal#${idx}`] || 0)
          });
          idx++;
      }

      if (items.length === 0 && ret.detailsMap['items']) {
         try {
             const parsed = JSON.parse(ret.detailsMap['items']);
             parsed.forEach((p: any) => items.push({
                 name: p.item_name || p.product_name || p.name,
                 qty: Number(p.qty || 1),
                 price: Number(p.sell_price || p.price || 0),
                 subtotal: Number(p.subtotal || (Number(p.qty || 1) * Number(p.sell_price || p.price || 0)))
             }));
         } catch(e) {}
      }

      return {
        uuid: ret.uuid,
        code: ret.code,
        date: ret.createdAt,
        referenceCode: ret.detailsMap['reference_journal_code'] || ret.detailsMap['reference_no'] || null,
        total: Number(ret.detailsMap['grand_total'] || ret.detailsMap['amount'] || 0),
        notes: ret.detailsMap['notes'] || '',
        member: memberName || 'Pelanggan Umum',
        memberUuid: memberUuid || null,
        items: items
      };
    });

    // 5. Pencarian Global
    let filteredReturns = allReturns;
    if (search) {
        const lowerSearch = search.toLowerCase();
        filteredReturns = allReturns.filter(r => 
            r.code.toLowerCase().includes(lowerSearch) ||
            (r.referenceCode && r.referenceCode.toLowerCase().includes(lowerSearch)) ||
            r.member.toLowerCase().includes(lowerSearch)
        );
    }

    // 6. Summary Kalkulasi
    let totalNilaiRetur = 0;
    let totalItemRetur = 0;

    filteredReturns.forEach(ret => {
        totalNilaiRetur += ret.total;
        if (ret.items && ret.items.length > 0) {
            totalItemRetur += ret.items.reduce((sum, i) => sum + (i.qty || 0), 0);
        }
    });

    const summary = { totalNilaiRetur, totalItemRetur };

    // 7. Paginasi Server Side
    const totalRecords = filteredReturns.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedData = filteredReturns.slice(startIndex, startIndex + Number(limit));

    return {
        data: paginatedData,
        summary,
        meta: {
            total: totalRecords,
            page: Number(page),
            limit: Number(limit)
        }
    };
  }
}