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
            
            // Simpan Supplier UUID (Supplier) - BARU DITAMBAHKAN
            if (item.supplierUuid) {
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `stok_supplier_uuid#${index}`,
                    value: String(item.supplierUuid),
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

    // 4. Hitung stok (Qty Plus - Qty Min), Total Masuk, dan Total Keluar
    const stockMap = new Map<string, { total_in: number; total_out: number; stock: number }>();
    
    for (const key in groups) {
      const g = groups[key];
      // Pastikan data jurnal ini masuk/keluar dari gudang yang diminta
      if (g.stok_warehouse_uuid === warehouseUuid) {
        const prodId = g.stok_product_uuid;
        if (!prodId) continue;

        const qtyPlus = Number(g.stok_qty_plus) || 0;
        const qtyMin = Number(g.stok_qty_min) || 0;
        const netQty = qtyPlus - qtyMin;

        // Ambil data sementara atau buat data awal
        const currentData = stockMap.get(prodId) || { total_in: 0, total_out: 0, stock: 0 };
        
        currentData.total_in += qtyPlus;
        currentData.total_out += qtyMin;
        currentData.stock += netQty;

        stockMap.set(prodId, currentData);
      }
    }

    // 5. Query produk yang stoknya tersisa ATAU pernah ada mutasi di gudang ini
    const products: any[] = [];
    for (const [prodId, data] of stockMap.entries()) {
      // Tampilkan jika pernah masuk atau keluar, meskipun stoknya jadi 0
      if (data.total_in > 0 || data.total_out > 0) {
        const product = await this.dataSource.getRepository('ProductEntity').findOne({
          where: { uuid: prodId },
          relations: ['categories', 'unit'] // Load relasi agar nama kategori & satuan muncul di frontend
        });
        
        if (product) {
          products.push({ 
            ...product, 
            stock: data.stock, 
            total_in: data.total_in, 
            total_out: data.total_out 
          });
        }
      }
    }

    return {
      ...warehouse,
      products: products
    };
  }

  // Tambahkan fungsi ini di dalam class JournalStokService
  async getWarehouseHistory(warehouseUuid: string, storeUuid: string) {
    // 1. Cari detail jurnal yang menunjuk ke warehouse yang dipilih
    const whDetails = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .where("jd.journalCode LIKE :store", { store: `%-${storeUuid}-%` })
      .andWhere("jd.key LIKE 'stok_warehouse_uuid#%'")
      .andWhere("jd.value = :warehouseUuid", { warehouseUuid })
      .getMany();

    if (!whDetails || whDetails.length === 0) return [];

    // 2. Dapatkan kombinasi journalCode dan index baris (misal: #0, #1)
    const targetItems = whDetails.map(d => {
      const index = d.key.split('#')[1];
      return { journalCode: d.journalCode, index };
    });

    const journalCodes = [...new Set(targetItems.map(t => t.journalCode))];

    // 3. Ambil data Header Jurnal (untuk mendapatkan tanggal, referensi, user)
    const journals = await this.dataSource.getRepository(JournalEntity)
      .createQueryBuilder('j')
      .where("j.code IN (:...codes)", { codes: journalCodes })
      .getMany();

    // 4. Ambil semua detail jurnal lain yang berkaitan dengan baris stok tersebut
    const allDetails = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .where("jd.journalCode IN (:...codes)", { codes: journalCodes })
      .andWhere("jd.key LIKE 'stok_%'")
      .getMany();

    // 5. Ambil data Produk untuk mendapatkan nama
    const productUuids = [...new Set(allDetails.filter(d => d.key.startsWith('stok_product_uuid#')).map(d => d.value))];
    let products: any[] = [];
    if (productUuids.length > 0) {
      products = await this.dataSource.getRepository('ProductEntity') // Pastikan entitas Product benar
        .createQueryBuilder('p')
        .where("p.uuid IN (:...uuids)", { uuids: productUuids })
        .getMany();
    }

    // 6. Rangkai data menjadi format history untuk frontend
    const history: any[] = [];

    for (const item of targetItems) {
      const journal = journals.find(x => x.code === item.journalCode);
      if (!journal) continue;

      const pUuidDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_product_uuid#${item.index}`);
      const qPlusDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_qty_plus#${item.index}`);
      const qMinDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_qty_min#${item.index}`);

      if (!pUuidDet) continue;

      const prod = products.find(p => p.uuid === pUuidDet.value);
      const qtyPlus = Number(qPlusDet?.value || 0);
      const qtyMin = Number(qMinDet?.value || 0);

      // Tentukan type IN/OUT dan jumlah Qty mutasi
      const type = qtyPlus > 0 ? 'IN' : 'OUT';
      const qty = qtyPlus > 0 ? qtyPlus : qtyMin;

      // Format tanggal ke "YYYY-MM-DD HH:mm:ss" agar bisa di split di Vue frontend
      const dateObj = journal.verifiedAt || new Date(); 
      const dateStr = new Date(dateObj).toISOString().replace('T', ' ').substring(0, 19);

      history.push({
        date: dateStr,
        ref: journal.code,
        product: prod ? prod.name : 'Unknown Product',
        type: type,
        qty: qty,
        user: journal.createdBy 
      });
    }

    // 7. Urutkan berdasarkan waktu terbaru (Descending)
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return history;
  }
  
  // FUNGSI UNTUK MUTASI MANUAL DARI FRONTEND
  async createManualMutation(payload: any, userId: string, storeUuid: string) {
    const { type, product_uuid, warehouse_uuid, shelve_uuid, qty, note } = payload;
    
    // Format item agar sesuai dengan struktur jurnal
    const item = {
        productUuid: product_uuid,
        warehouseUuid: warehouse_uuid,
        shelveUuid: shelve_uuid,
        qty: Number(qty)
    };

    // Jalankan jurnal stok tanpa externalManager agar membuat transaksi baru (independen)
    if (type === 'IN') {
        return await this._executeStockJournal('STOCK_IN', [item], userId, storeUuid, undefined, note);
    } else if (type === 'OUT') {
        return await this._executeStockJournal('STOCK_OUT', [item], userId, storeUuid, undefined, note);
    } else {
        throw new BadRequestException('Tipe mutasi tidak valid');
    }
  }

  async getInventoryReport(storeUuid: string, startDate: string, endDate: string) {
    const query = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany('journal.details', JournalDetailEntity, 'detail', 'detail.journalCode = journal.code')
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.createdAt BETWEEN :start AND :end', { 
        start: `${startDate} 00:00:00`, 
        end: `${endDate} 23:59:59` 
      })
      .orderBy('journal.createdAt', 'ASC');

    const journals = await query.getMany();

    // Map untuk menampung mutasi per produk
    const inventoryMap = new Map();

    journals.forEach(j => {
      const detailsMap = j.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});
      
      let idx = 0;
      // Loop item di setiap jurnal (SALE, BUY, RET_SALE, RET_BUY, ADJUSTMENT)
      while (detailsMap[`product_uuid#${idx}`]) {
        const pUuid = detailsMap[`product_uuid#${idx}`];
        const pName = detailsMap[`item_name#${idx}`] || detailsMap[`product_name#${idx}`];
        const qty = Number(detailsMap[`qty#${idx}`] || detailsMap[`qty_return#${idx}`] || 0);
        const unit = detailsMap[`unit_name#${idx}`] || 'Unit';

        if (!inventoryMap.has(pUuid)) {
          inventoryMap.set(pUuid, { 
            uuid: pUuid, name: pName, unit: unit,
            stockIn: 0, stockOut: 0, adjustment: 0, finalStock: 0 
          });
        }

        const item = inventoryMap.get(pUuid);

        // Logika Mutasi Berdasarkan Kode Jurnal
        if (j.code.startsWith('BUY') || j.code.startsWith('RET_SALE')) {
          item.stockIn += qty;
        } else if (j.code.startsWith('SALE') || j.code.startsWith('RET_BUY')) {
          item.stockOut += qty;
        } else if (j.code.startsWith('ADJ')) {
          item.adjustment += qty; // Bisa minus jika stok berkurang
        }
        
        idx++;
      }
    });

    return Array.from(inventoryMap.values()).map(item => ({
      ...item,
      finalStock: item.stockIn - item.stockOut + item.adjustment
    }));
  }

  async getStockMovementChart(storeUuid: string, startDate: string, endDate: string) {
    // Ambil semua jurnal yang memiliki pengaruh ke stok dalam rentang tanggal
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndSelect('journal.details', 'detail')
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.createdAt BETWEEN :start AND :end', { 
        start: `${startDate} 00:00:00`, 
        end: `${endDate} 23:59:59` 
      })
      .orderBy('journal.createdAt', 'ASC')
      .getMany();

    const chartMap = new Map();

    // Inisialisasi map agar semua tanggal di range muncul (opsional, tapi disarankan)
    // Jika ingin hanya tanggal yang ada transaksi saja, lewati bagian inisialisasi ini.

    journals.forEach(j => {
      // Ambil tanggal murni (YYYY-MM-DD)
      const dateKey = j.createdAt.toISOString().split('T')[0];
      
      if (!chartMap.has(dateKey)) {
        chartMap.set(dateKey, { date: dateKey, masuk: 0, keluar: 0 });
      }
      
      const entry = chartMap.get(dateKey);
      
      // Ambil detail jurnal untuk mencari qty
      j.details.forEach(detail => {
        // Kita hanya mencari key yang mengandung 'qty'
        if (detail.key.startsWith('qty#') || detail.key.startsWith('qty_return#') || detail.key === 'qty') {
          const qtyValue = Number(detail.value || 0);

          // LOGIKA PEMISAHAN MASUK VS KELUAR
          // Masuk: Pembelian (BUY) atau Retur Penjualan (RET_SALE)
          if (j.code.includes('BUY') || j.code.includes('RET_SALE')) {
            entry.masuk += qtyValue;
          } 
          // Keluar: Penjualan (SALE) atau Retur Pembelian (RET_BUY)
          else if (j.code.includes('SALE') || j.code.includes('RET_BUY')) {
            entry.keluar += qtyValue;
          }
        }
      });
    });

    const result = Array.from(chartMap.values());
    
    // DEBUG: Cek di terminal backend Anda
    console.log(`Chart Data Found for ${storeUuid}:`, result.length, 'days');
    
    return result;
  }

  async breakStock(payload: any, userId: string, storeUuid: string) {
    const { 
        sourceProductUuid, sourceVariantUuid, sourceUnitUuid, // <-- Ambil unit sumber dari payload
        targetProductUuid, targetVariantUuid, targetUnitUuid, // <-- Ambil unit tujuan dari payload
        qtyToBreak, conversionVal
    } = payload;

    return await this.dataSource.transaction(async (manager) => {
        // 1. Ambil info produk beserta relasi Rak (shelves) dan Gudang (warehouse)
        const source = await manager.getRepository('ProductEntity').findOne({ 
            where: { uuid: sourceProductUuid },
            relations: ['shelves', 'shelves.warehouse'] 
        });
        
        const target = await manager.getRepository('ProductEntity').findOne({ 
            where: { uuid: targetProductUuid },
            relations: ['shelves', 'shelves.warehouse']
        });

        if (!source || !target) {
            throw new Error('Produk sumber atau tujuan tidak ditemukan di database.');
        }

        // 2. Cari Warehouse UUID dan Shelve UUID dari Rak Default (Index 0)
        // Set fallback jika data tidak tersedia
        const sourceShelveUuid = source.shelves && source.shelves.length > 0 
            ? source.shelves[0].uuid 
            : null; // <-- Ambil UUID rak sumber

        const sourceWarehouseUuid = source.shelves && source.shelves.length > 0 
            ? (source.shelves[0].warehouse?.uuid || source.shelves[0].warehouseUuid)
            : storeUuid;

        const targetShelveUuid = target.shelves && target.shelves.length > 0 
            ? target.shelves[0].uuid 
            : null; // <-- Ambil UUID rak tujuan

        const targetWarehouseUuid = target.shelves && target.shelves.length > 0 
            ? (target.shelves[0].warehouse?.uuid || target.shelves[0].warehouseUuid)
            : storeUuid;

        // 3. STOK KELUAR dari Produk Sumber (Unit Besar)
        await this.stockOut([{
            productUuid: sourceProductUuid,
            variantUuid: sourceVariantUuid,
            unitUuid: sourceUnitUuid,       // <-- Masukkan unit sumber
            shelveUuid: sourceShelveUuid,   // <-- Masukkan rak sumber
            qty: qtyToBreak,
            warehouseUuid: sourceWarehouseUuid 
        }], userId, manager, storeUuid, `Konversi keluar ke: ${target.name}`);

        // 4. STOK MASUK ke Produk Tujuan (Unit Kecil)
        const totalAdd = qtyToBreak * conversionVal;
        await this.stockIn([{
            productUuid: targetProductUuid,
            variantUuid: targetVariantUuid,
            unitUuid: targetUnitUuid,       // <-- Masukkan unit tujuan
            shelveUuid: targetShelveUuid,   // <-- Masukkan rak tujuan
            qty: totalAdd,
            warehouseUuid: targetWarehouseUuid 
        }], userId, manager, storeUuid, `Konversi masuk dari: ${source.name}`);

        return { 
            message: 'Konversi stok berhasil', 
            addedQty: totalAdd,
            sourceWarehouse: sourceWarehouseUuid,
            sourceShelve: sourceShelveUuid,
            targetWarehouse: targetWarehouseUuid,
            targetShelve: targetShelveUuid
        };
    });
  }
}