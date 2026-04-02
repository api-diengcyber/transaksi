import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalStokService {
  constructor(
    private readonly journalService: JournalService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  // FUNGSI UNTUK STOK MASUK (STOCK IN)
  async stockIn(items: any[], userId: string, manager: EntityManager, storeUuid: string, notes?: string) {
    if (!items || items.length === 0) return;
    await this._executeStockJournal('STOCK_IN', items, userId, storeUuid, manager, notes);
  }

  // FUNGSI UNTUK STOK KELUAR (STOCK OUT / BARANG RUSAK)
  async stockOut(items: any[], userId: string, manager: EntityManager, storeUuid: string, notes?: string) {
    if (!items || items.length === 0) return;
    await this._executeStockJournal('STOCK_OUT', items, userId, storeUuid, manager, notes);
  }

  // --- KODE PRIVATE YANG SANGAT SIMPLE ---
  private async _executeStockJournal(
    type: string, 
    items: any[], 
    userId: string, 
    storeUuid: string, 
    externalManager?: EntityManager, 
    notes?: string
  ) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode(type, storeUuid);
        
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

        // 2. Simpan Catatan (Notes) jika ada
        if (notes) {
            detailEntities.push(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                key: 'notes',
                value: notes,
                journalCode: code,
                createdBy: userId,
            }));
        }

        // 3. Simpan Detail Item secara manual dan eksplisit
        items.forEach((item, index) => {
            
            // Simpan Product UUID
            if (item.productUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_product_uuid#${index}`,
                    value: String(item.productUuid),
                    journalCode: code,
                    createdBy: userId,
                }));
            }

            // Simpan Variant UUID (Jika ada varian)
            if (item.variantUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_variant_uuid#${index}`,
                    value: String(item.variantUuid),
                    journalCode: code,
                    createdBy: userId,
                }));
            }

            // Simpan Unit UUID
            if (item.unitUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_unit#${index}`,
                    value: String(item.unitUuid),
                    journalCode: code,
                    createdBy: userId,
                }));
            }

            // Simpan Shelve UUID (Rak) - BARU
            if (item.shelveUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_shelve_uuid#${index}`,
                    value: String(item.shelveUuid),
                    journalCode: code,
                    createdBy: userId,
                }));
            }

            // Simpan Warehouse UUID (Gudang) - BARU
            if (item.warehouseUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_warehouse_uuid#${index}`,
                    value: String(item.warehouseUuid),
                    journalCode: code,
                    createdBy: userId,
                }));
            }

            // Simpan Qty (Menggunakan qty_plus untuk IN, dan qty_min untuk OUT)
            const qtyKey = type === 'STOCK_IN' ? `stok_qty_plus#${index}` : `stok_qty_min#${index}`;
            if (item.qty !== undefined && item.qty !== null) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: qtyKey,
                    value: String(item.qty),
                    journalCode: code,
                    createdBy: userId,
                }));
            }
        });

        // 4. Save Semua Details Sekaligus ke Database
        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        return { message: `${type} journal created`, journal, details: detailEntities };
    };

    // Jalankan menggunakan manager yang sudah ada (Transaction) atau buat baru
    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  async getWarehouseStock(warehouseUuid: string, storeUuid: string) {
    // 1. Ambil detail gudang
    const warehouse = await this.dataSource.getRepository('WarehouseEntity').findOne({ 
        where: { uuid: warehouseUuid }
    });
    if (!warehouse) throw new BadRequestException('Gudang tidak ditemukan');

    // 2. Ambil semua jurnal yang berkaitan dengan stok di toko ini
    const details = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .where("jd.journalCode LIKE :store", { store: `%-${storeUuid}-%` })
      .andWhere("jd.key LIKE 'stok_%'")
      .getMany();

    // 3. Kelompokkan jurnal berdasarkan kode jurnal dan index baris (Contoh: JRN-001_0)
    const groups: Record<string, any> = {};
    for (const d of details) {
      const [baseKey, index] = d.key.split('#');
      const groupKey = `${d.journalCode}_${index}`;
      if (!groups[groupKey]) groups[groupKey] = {};
      groups[groupKey][baseKey] = d.value;
    }

    // 4. Hitung stok (Qty Plus - Qty Min) khusus untuk gudang ini
    const stockMap = new Map<string, number>();
    for (const key in groups) {
      const g = groups[key];
      // Pastikan data jurnal ini masuk/keluar dari gudang yang diminta
      if (g.stok_warehouse_uuid === warehouseUuid) {
        const prodId = g.stok_product_uuid;
        const qtyPlus = Number(g.stok_qty_plus) || 0;
        const qtyMin = Number(g.stok_qty_min) || 0;
        const netQty = qtyPlus - qtyMin;

        stockMap.set(prodId, (stockMap.get(prodId) || 0) + netQty);
      }
    }

    // 5. Query produk yang stoknya tersisa (> 0) di gudang ini
    const products: any[] = [];
    for (const [prodId, qty] of stockMap.entries()) {
      if (qty > 0) {
        const product = await this.dataSource.getRepository('ProductEntity').findOne({
          where: { uuid: prodId },
          relations: ['categories', 'unit'] // Load relasi agar nama kategori & satuan muncul di frontend
        });
        if (product) {
          products.push({ ...product, stock: qty });
        }
      }
    }

    return {
      ...warehouse,
      products: products
    };
  }
}