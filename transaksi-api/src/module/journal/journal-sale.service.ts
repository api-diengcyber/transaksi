import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';
import { JournalArService } from './journal-ar.service'; // <-- IMPORT AR SERVICE

@Injectable()
export class JournalSaleService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject(forwardRef(() => JournalArService)) // <-- INJECT AR SERVICE (Gunakan forwardRef untuk hindari Circular Dependency)
    private readonly journalArService: JournalArService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createSale(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('SALE', storeUuid);
        
        // 1. Simpan Header Jurnal Penjualan (Bisa Tunai atau Kredit)
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

        // 2. Insert Detail Global (Menyimpan is_credit, due_date, customer_name, dll)
        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items') return; 
          if (value === null || value === undefined) return;
  
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

          if (valStr.length > 250) valStr = valStr.substring(0, 250);

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        // 3. Ekstrak Items & Parsing Stok Keluar (Stock Out)
        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            const stockItemsToDeduct: any[] = [];

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];
                
                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                if (!finalWarehouseUuid && (item.shelve_uuid || item.stok_shelve_uuid)) {
                    const shelveId = item.shelve_uuid || item.stok_shelve_uuid;
                    const shelveData: any = await manager.getRepository('ShelveEntity').findOne({ 
                        where: { uuid: shelveId },
                        relations: ['warehouse'] 
                    });
                    if (shelveData && shelveData.warehouse) finalWarehouseUuid = shelveData.warehouse.uuid;
                }
                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                stockItemsToDeduct.push({
                    productUuid: item.product_uuid || item.stok_product_uuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    shelveUuid: item.shelve_uuid || item.stok_shelve_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    qty: Number(item.qty || item.stok_qty_min || 1) 
                });

                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_min', 
                    'stok_shelve_uuid', 'stok_warehouse_uuid', 'stok_variant_uuid',
                    'shelve_uuid', 'warehouse_uuid'
                ];
                keysToDelete.forEach(k => delete item[k]);

                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.journalService.toSnakeCase(itemKey)}#${index}`;
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

            // 4. JALANKAN PEMOTONGAN STOK
            if (stockItemsToDeduct.length > 0) {
                await this.journalStokService.stockOut(
                    stockItemsToDeduct, 
                    userId, 
                    manager, 
                    storeUuid, 
                    `Otomatis dari Penjualan: ${code}`
                );
            }
        }

        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        // ==================================================================
        // 5. OTOMATISASI PIUTANG (AR) JIKA TRANSAKSI ADALAH KREDIT/HUTANG
        // ==================================================================
        const isCredit = dataDetails.is_credit === 'true' || dataDetails.is_credit === true || dataDetails.payment_method === 'CREDIT';

        if (isCredit) {
            // Hitung Piutang Murni (Total Belanja dikurangi Uang Muka / DP)
            const amountCredit = Number(dataDetails.amount_credit) || (Number(dataDetails.grand_total) - Number(dataDetails.amount_cash || 0));

            if (amountCredit > 0) {
                const arPayload = {
                    amount: amountCredit, // Sisa piutang bersih
                    dp_amount: Number(dataDetails.amount_cash || 0), // DP (Uang tunai yang dibayar di awal)
                    due_date: dataDetails.due_date,
                    notes: `Piutang otomatis dari Nota Penjualan: ${code} ${dataDetails.notes ? ' | ' + dataDetails.notes : ''}`,
                    customer_name: dataDetails.customer_name || 'Pelanggan Umum',
                    member_uuid: dataDetails.member_uuid || null,
                    reference_journal_code: code, // Tautkan piutang ini ke Nota SALE
                };

                // Panggil service AR di dalam transaksi (manager) yang sama agar jika gagal, SALE ikut di-rollback
                await this.journalArService.createAr(arPayload, userId, storeUuid, manager);
            }
        }

        return { message: 'SALE journal created successfully', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }
}