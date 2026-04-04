import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';

@Injectable()
export class JournalBuyService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createBuy(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('BUY', storeUuid);
        
        // 1. Simpan Header Jurnal Pembelian (BUY)
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(JournalEntity, journal);

        const detailEntities: JournalDetailEntity[] = [];

        // AMAN DARI NESTED OBJECT: Buka bungkus "details" jika frontend mengirim format { details: {...} }
        const dataDetails = payload.details ? payload.details : payload;

        // 2. Insert Detail Parameter Global
        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items') return; 
          if (value === null || value === undefined) return;
  
          // Ubah ke string
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

          // PENGAMANAN: Potong string jika lebih dari 255 karakter untuk menghindari Error ER_DATA_TOO_LONG
          if (valStr.length > 250) {
              valStr = valStr.substring(0, 250);
          }

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        // 3. Ekstrak Items & Parsing Stok (Stock In)
        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            
            const stockItemsToAdd: any[] = [];

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];

                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                
                // Cari relasi rak -> gudang jika kosong
                if (!finalWarehouseUuid && (item.shelve_uuid || item.stok_shelve_uuid)) {
                    const shelveId = item.shelve_uuid || item.stok_shelve_uuid;
                    const shelveData: any = await manager.getRepository('ShelveEntity').findOne({ 
                        where: { uuid: shelveId },
                        relations: ['warehouse'] 
                    });
                    if (shelveData && shelveData.warehouse) {
                        finalWarehouseUuid = shelveData.warehouse.uuid;
                    }
                }

                // Fallback Gudang
                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                // --- B. MASUKKAN DATA KE ANTRIAN STOCK_IN ---
                stockItemsToAdd.push({
                    productUuid: item.product_uuid || item.stok_product_uuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    shelveUuid: item.shelve_uuid || item.stok_shelve_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    supplierUuid: item.supplier_uuid || item.stok_supplier_uuid,
                    qty: Number(item.qty || item.stok_qty_plus || 1)
                });

                // --- C. HAPUS PROPERTI STOK AGAR JURNAL BUY BERSIH ---
                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_plus', 'stok_qty_min', 
                    'stok_shelve_uuid', 'stok_warehouse_uuid', 'stok_variant_uuid',
                    'shelve_uuid', 'warehouse_uuid', 'supplier_uuid'
                ];
                keysToDelete.forEach(k => delete item[k]);

                // --- D. MASUKKAN SISA ITEM (Struk Murni) KE DETAIL BUY ---
                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.journalService.toSnakeCase(itemKey)}#${index}`;
                    const valStr = typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue);
  
                    if (valStr.length > 0) {
                        detailEntities.push(manager.create(JournalDetailEntity, {
                            uuid: generateJournalDetailUuid(storeUuid),
                            key: dbKey,
                            // Pengamanan item detail
                            value: valStr.length > 250 ? valStr.substring(0, 250) : valStr, 
                            journalCode: code,
                            createdBy: userId,
                        }));
                    }
                });
            }

            // 4. JALANKAN PENAMBAHAN STOK (STOCK IN)
            if (stockItemsToAdd.length > 0) {
                await this.journalStokService.stockIn(
                    stockItemsToAdd, 
                    userId, 
                    manager,
                    storeUuid, 
                    `Otomatis dari Pembelian/Stok Masuk: ${code}`
                );
            }
        }

        // 5. Simpan detail jurnal Pembelian (BUY) ke DB
        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        return { message: 'BUY journal created and Stock properly added', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }
}