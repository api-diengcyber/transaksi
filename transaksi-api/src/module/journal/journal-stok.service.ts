import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
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

  // ===========================================================================
  // CORE MUTATION METHODS
  // ===========================================================================

  async stockIn(items: any[], userId: string, manager: EntityManager | undefined, storeUuid: string, notes?: string, isDraft = false, isOpname = false) {
    return await this._executeStockJournal('STOCK_IN', items, userId, storeUuid, manager, notes, isDraft, isOpname);
  }

  async stockOut(items: any[], userId: string, manager: EntityManager | undefined, storeUuid: string, notes?: string, isDraft = false, isOpname = false) {
    return await this._executeStockJournal('STOCK_OUT', items, userId, storeUuid, manager, notes, isDraft, isOpname);
  }

  private async _executeStockJournal(
    type: string, items: any[], userId: string, storeUuid: string, 
    externalManager?: EntityManager, notes?: string, isDraft = false, isOpname = false
  ) {
    if (!storeUuid || items.length === 0) throw new BadRequestException('Invalid data for stock movement.');

    const work = async (manager: EntityManager) => {
      const codeType = isOpname ? 'OPNAME' : type;
      const code = await this.journalService.generateCode(codeType, storeUuid);
      
      const journal = manager.create(JournalEntity, {
        uuid: `${storeUuid}-JRN-${generateLocalUuid()}`,
        code, createdBy: userId,
        verifiedBy: isDraft ? null : userId,
        verifiedAt: isDraft ? null : new Date(), 
      });
      await manager.save(JournalEntity, journal);

      const detailEntities: JournalDetailEntity[] = [];
      const addDetail = (key: string, value: string) => {
        detailEntities.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: code, createdBy: userId, key, value
        }));
      };

      addDetail('journal_type', codeType);
      addDetail('store_uuid', storeUuid);
      if (notes) addDetail('notes', notes);

      items.forEach((item, index) => {
        addDetail(`stok_user_uuid#${index}`, String(userId));
        if (item.productUuid) addDetail(`stok_product_uuid#${index}`, String(item.productUuid));
        if (item.variantUuid) addDetail(`stok_variant_uuid#${index}`, String(item.variantUuid));
        if (item.unitUuid) addDetail(`stok_unit#${index}`, String(item.unitUuid));
        if (item.shelveUuid) addDetail(`stok_shelve_uuid#${index}`, String(item.shelveUuid));
        if (item.warehouseUuid) addDetail(`stok_warehouse_uuid#${index}`, String(item.warehouseUuid));
        if (item.supplierUuid) addDetail(`stok_supplier_uuid#${index}`, String(item.supplierUuid));

        const qtyKey = type === 'STOCK_IN' ? `stok_qty_plus#${index}` : `stok_qty_min#${index}`;
        if (item.qty !== undefined) addDetail(qtyKey, String(item.qty));
      });

      await manager.save(JournalDetailEntity, detailEntities);
      return { journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  // ===========================================================================
  // STOCK CALCULATION LOGIC (DRY - Unified Logic)
  // ===========================================================================

  private _processGroupsToStockMap(details: JournalDetailEntity[], filterUuids?: string[], warehouseUuid?: string): Map<string, any> {
    const groups: Record<string, any> = {};
    for (const d of details) {
      const [baseKey, index] = d.key.split('#');
      const groupKey = `${d.journalCode}_${index}`;
      if (!groups[groupKey]) groups[groupKey] = {};
      groups[groupKey][baseKey] = d.value;
    }

    const stockMap = new Map<string, any>();
    for (const key in groups) {
      const g = groups[key];
      const prodId = g.stok_product_uuid;
      
      // Filter berdasarkan warehouse (jika ada) dan product list (jika ada)
      if (warehouseUuid && g.stok_warehouse_uuid !== warehouseUuid) continue;
      if (filterUuids && !filterUuids.includes(prodId)) continue;
      if (!prodId) continue;

      const variantUuid = g.stok_variant_uuid && g.stok_variant_uuid !== 'null' ? g.stok_variant_uuid : 'null';
      const qtyPlus = Number(g.stok_qty_plus) || 0;
      const qtyMin = Number(g.stok_qty_min) || 0;
      const mapKey = `${prodId}_${variantUuid}`;

      const current = stockMap.get(mapKey) || { stock: 0, total_in: 0, total_out: 0 };
      current.total_in += qtyPlus;
      current.total_out += qtyMin;
      current.stock += (qtyPlus - qtyMin);
      stockMap.set(mapKey, current);
    }
    return stockMap;
  }

  async calculateStockFromJournal(productUuids: string[], storeUuid: string) {
    if (!productUuids.length) return new Map<string, number>();

    const targetDetails = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .select('jd.journalCode', 'code')
      .where("jd.key LIKE 'stok_product_uuid%' AND jd.value IN (:...uuids)", { uuids: productUuids })
      .andWhere("jd.journalCode LIKE :store", { store: `%-${storeUuid}-%` })
      .getRawMany();

    if (!targetDetails.length) return new Map<string, number>();
    const journalCodes = [...new Set(targetDetails.map(t => t.code))];

    const details = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .innerJoin(JournalEntity, 'j', 'j.code = jd.journalCode')
      .where("jd.journalCode IN (:...codes) AND jd.key LIKE 'stok_%' AND j.verifiedAt IS NOT NULL", { codes: journalCodes })
      .getMany();

    const fullMap = this._processGroupsToStockMap(details, productUuids);
    const resultMap = new Map<string, number>();
    fullMap.forEach((val, key) => resultMap.set(key, val.stock));
    return resultMap;
  }

  async getWarehouseStock(warehouseUuid: string, storeUuid: string) {
    const warehouse = await this.dataSource.getRepository('WarehouseEntity').findOne({ where: { uuid: warehouseUuid } });
    if (!warehouse) throw new BadRequestException('Gudang tidak ditemukan');

    const details = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .innerJoin(JournalEntity, 'j', 'j.code = jd.journalCode')
      .where("jd.journalCode LIKE :store AND jd.key LIKE 'stok_%' AND j.verifiedAt IS NOT NULL", { store: `%-${storeUuid}-%` })
      .getMany();

    const stockMap = this._processGroupsToStockMap(details, undefined, warehouseUuid);
    const products: any[] = [];

    for (const [mapKey, data] of stockMap.entries()) {
      const [prodId] = mapKey.split('_');
      const product = await this.dataSource.getRepository('ProductEntity').findOne({ where: { uuid: prodId }, relations: ['categories', 'unit'] });
      if (product?.isManageStock) {
        products.push({ ...product, stock: data.stock, total_in: data.total_in, total_out: data.total_out });
      }
    }
    return { ...warehouse, products };
  }

  // ===========================================================================
  // CONVERSION METHODS (Break & Combine Simplified)
  // ===========================================================================

  async breakStock(payload: any, userId: string, storeUuid: string) {
    return this._executeConversion(payload, userId, storeUuid, 'BREAK');
  }

  async combineStock(payload: any, userId: string, storeUuid: string) {
    return this._executeConversion(payload, userId, storeUuid, 'COMBINE');
  }

  private async _executeConversion(payload: any, userId: string, storeUuid: string, mode: 'BREAK' | 'COMBINE') {
    return await this.dataSource.transaction(async (manager) => {
      const { sourceProductUuid, targetProductUuid, qtyToBreak, qtyAction, conversionVal } = payload;
      const source = await manager.getRepository('ProductEntity').findOne({ where: { uuid: sourceProductUuid }, relations: ['shelves', 'shelves.warehouse'] });
      const target = await manager.getRepository('ProductEntity').findOne({ where: { uuid: targetProductUuid }, relations: ['shelves', 'shelves.warehouse'] });

      if (!source || !target) throw new Error('Produk tidak ditemukan.');

      const getLoc = (p: any) => ({
        shelve: p.shelves?.[0]?.uuid || null,
        wh: p.shelves?.[0]?.warehouse?.uuid || p.shelves?.[0]?.warehouseUuid || storeUuid
      });

      const locSrc = getLoc(source);
      const locTrg = getLoc(target);

      const qtyOut = mode === 'BREAK' ? qtyToBreak : (qtyAction * conversionVal);
      const qtyIn = mode === 'BREAK' ? (qtyToBreak * conversionVal) : qtyAction;

      await this.stockOut([{ productUuid: sourceProductUuid, variantUuid: payload.sourceVariantUuid, unitUuid: source.unitUuid, shelveUuid: locSrc.shelve, warehouseUuid: locSrc.wh, qty: qtyOut }], userId, manager, storeUuid, `${mode} keluar ke ${target.name}`);
      await this.stockIn([{ productUuid: targetProductUuid, variantUuid: payload.targetVariantUuid, unitUuid: target.unitUuid, shelveUuid: locTrg.shelve, warehouseUuid: locTrg.wh, qty: qtyIn }], userId, manager, storeUuid, `${mode} masuk dari ${source.name}`);

      return { message: 'Konversi berhasil', addedQty: qtyIn, deductedQty: qtyOut };
    });
  }

  async createOpnameDraft(payload: any, storeUuid: string) {
    return await this.dataSource.transaction(async (manager) => {
        const itemsIn: any[] = [];
        const itemsOut: any[] = [];

        payload.items.forEach((item: any) => {
            const diff = Number(item.difference);
            if (diff === 0) return; 

            const mappedItem = {
                productUuid: item.product_uuid,
                warehouseUuid: payload.warehouse_uuid,
                shelveUuid: item.shelve_uuid,
                variantUuid: item.variant_uuid,
                unitUuid: item.unit_uuid,
                qty: Math.abs(diff)
            };

            if (diff > 0) itemsIn.push(mappedItem);
            if (diff < 0) itemsOut.push(mappedItem);
        });

        const isDraft = true;
        const isOpname = true;

        if (itemsIn.length > 0) {
            await this.stockIn(itemsIn, payload.user_uuid, manager, storeUuid, 'Draft Opname Fisik (Penambahan)', isDraft, isOpname);
        }
        if (itemsOut.length > 0) {
            await this.stockOut(itemsOut, payload.user_uuid, manager, storeUuid, 'Draft Opname Fisik (Pengurangan)', isDraft, isOpname);
        }

        return { message: 'Draft Opname berhasil dibuat dan menunggu verifikasi' };
    });
  }

  async getUnverifiedOpnames(warehouseUuid: string, storeUuid: string) {
    const drafts = await this.dataSource.getRepository(JournalEntity)
        .createQueryBuilder('j')
        .innerJoin(JournalDetailEntity, 'jd_type', "jd_type.journalCode = j.code AND jd_type.key = 'journal_type' AND jd_type.value = 'OPNAME'")
        .innerJoin(JournalDetailEntity, 'jd_wh', "jd_wh.journalCode = j.code AND jd_wh.key LIKE 'stok_warehouse_uuid#%' AND jd_wh.value = :warehouseUuid")
        .innerJoin(JournalDetailEntity, 'jd_store', "jd_store.journalCode = j.code AND jd_store.key = 'store_uuid' AND jd_store.value = :storeUuid")
        .where('j.verifiedAt IS NULL')
        .setParameters({ warehouseUuid, storeUuid })
        .orderBy('j.createdAt', 'ASC')
        .getMany();

    if (drafts.length === 0) return [];

    const codes = drafts.map(d => d.code);
    const details = await this.dataSource.getRepository(JournalDetailEntity)
        .createQueryBuilder('jd')
        .where('jd.journalCode IN (:...codes)', { codes })
        .andWhere("jd.key LIKE 'stok_product_uuid#%'")
        .getMany();

    return drafts.map(d => {
        const detailCount = details.filter(jd => jd.journalCode === d.code).length;
        return { ...d, details: new Array(detailCount) };
    });
  }

  async verifyOpnameJournal(journalUuid: string, adminUuid: string) {
    return await this.dataSource.transaction(async (manager) => {
        const journal = await manager.getRepository(JournalEntity).findOne({
            where: { uuid: journalUuid }
        });
        
        if (!journal) throw new NotFoundException('Dokumen Opname tidak ditemukan');
        if (journal.verifiedAt) throw new BadRequestException('Dokumen sudah diverifikasi');

        journal.verifiedAt = new Date();
        journal.verifiedBy = adminUuid;
        
        await manager.save(JournalEntity, journal);

        return { message: 'Opname diverifikasi dan stok otomatis disesuaikan', data: journal };
    });
  }

  async getWarehouseHistory(warehouseUuid: string, storeUuid: string) {
    const whDetails = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .where("jd.journalCode LIKE :store", { store: `%-${storeUuid}-%` })
      .andWhere("jd.key LIKE 'stok_warehouse_uuid#%'")
      .andWhere("jd.value = :warehouseUuid", { warehouseUuid })
      .getMany();

    if (!whDetails || whDetails.length === 0) return [];

    const targetItems = whDetails.map(d => {
      const index = d.key.split('#')[1];
      return { journalCode: d.journalCode, index };
    });

    const journalCodes = [...new Set(targetItems.map(t => t.journalCode))];

    const journals = await this.dataSource.getRepository(JournalEntity)
      .createQueryBuilder('j')
      .where("j.code IN (:...codes)", { codes: journalCodes })
      .andWhere("j.verifiedAt IS NOT NULL")
      .getMany();

    const allDetails = await this.dataSource.getRepository(JournalDetailEntity)
      .createQueryBuilder('jd')
      .where("jd.journalCode IN (:...codes)", { codes: journalCodes })
      .andWhere("jd.key LIKE 'stok_%'")
      .getMany();

    const productUuids = [...new Set(allDetails.filter(d => d.key.startsWith('stok_product_uuid#')).map(d => d.value))];
    let products: any[] = [];
    if (productUuids.length > 0) {
      products = await this.dataSource.getRepository('ProductEntity')
        .createQueryBuilder('p')
        .where("p.uuid IN (:...uuids) AND p.isManageStock = true", { uuids: productUuids }) 
        .getMany();
    }

    const history: any[] = [];

    for (const item of targetItems) {
      const journal = journals.find(x => x.code === item.journalCode);
      if (!journal) continue; 

      const pUuidDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_product_uuid#${item.index}`);
      const qPlusDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_qty_plus#${item.index}`);
      const qMinDet = allDetails.find(d => d.journalCode === item.journalCode && d.key === `stok_qty_min#${item.index}`);

      if (!pUuidDet) continue;

      const prod = products.find(p => p.uuid === pUuidDet.value);
      if (!prod) continue;

      const qtyPlus = Number(qPlusDet?.value || 0);
      const qtyMin = Number(qMinDet?.value || 0);

      const type = qtyPlus > 0 ? 'IN' : 'OUT';
      const qty = qtyPlus > 0 ? qtyPlus : qtyMin;

      const dateObj = journal.verifiedAt || new Date(); 
      const dateStr = new Date(dateObj).toISOString().replace('T', ' ').substring(0, 19);

      history.push({
        date: dateStr,
        ref: journal.code,
        product: prod.name,
        type: type,
        qty: qty,
        user: journal.createdBy 
      });
    }

    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return history;
  }
  
  async createManualMutation(payload: any, userId: string, storeUuid: string) {
    const { type, product_uuid, warehouse_uuid, shelve_uuid, qty, note } = payload;
    
    const item = {
        productUuid: product_uuid,
        warehouseUuid: warehouse_uuid,
        shelveUuid: shelve_uuid,
        qty: Number(qty)
    };

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

    const inventoryMap = new Map();

    const productUuidsToFetch = new Set<string>();
    journals.forEach(j => {
        j.details.forEach((d: any) => {
            if (d.key.startsWith('product_uuid#') || d.key.startsWith('stok_product_uuid#')) {
                productUuidsToFetch.add(d.value);
            }
        });
    });

    // Gunakan Array alih-alih Set untuk mengambil data product dari repository
    let managedProducts: any[] = []; 
    if (productUuidsToFetch.size > 0) {
        managedProducts = await this.dataSource.getRepository('ProductEntity')
            .createQueryBuilder('p')
            .where("p.uuid IN (:...uuids)", { uuids: Array.from(productUuidsToFetch) })
            .andWhere("p.isManageStock = true") 
            .getMany();
    }
    
    // Buat Map untuk lookup nama dan unit produk secara langsung DARI DATABASE
    // Ini jauh lebih aman dan akurat daripada mengandalkan teks dari journal detail
    const managedProductMap = new Map();
    managedProducts.forEach(p => {
        managedProductMap.set(p.uuid, {
            name: p.name || p.productName || 'Unknown Product',
            unit: p.unitName || p.unit || 'Pcs'
        });
    });

    journals.forEach(j => {
      const detailsMap = j.details.reduce((acc: any, curr: any) => { 
          acc[curr.key] = curr.value; 
          return acc; 
      }, {});
      
      let idx = 0;
      // Perbaiki kondisi while: Cek apakah key 'product_uuid#idx' ATAU 'stok_product_uuid#idx' ada
      while (
        detailsMap.hasOwnProperty(`product_uuid#${idx}`) || 
        detailsMap.hasOwnProperty(`stok_product_uuid#${idx}`)
      ) {
        const pUuid = detailsMap[`product_uuid#${idx}`] || detailsMap[`stok_product_uuid#${idx}`];
        
        // Lewati jika produk tidak ada di map produk yang dikelola stoknya
        if (!managedProductMap.has(pUuid)) {
            idx++;
            continue; 
        }

        // AMBIL NAMA DAN UNIT DARI DATABASE (Lebih aman!)
        const dbProduct = managedProductMap.get(pUuid);
        // Fallback ke detail journal jika di DB entah kenapa kosong, lalu fallback ke 'Unknown'
        const pName = dbProduct.name !== 'Unknown Product' ? dbProduct.name : (detailsMap[`item_name#${idx}`] || detailsMap[`product_name#${idx}`] || 'Unknown');
        const unit = dbProduct.unit !== 'Pcs' ? dbProduct.unit : (detailsMap[`unit_name#${idx}`] || 'Unit');

        // Ambil QTY
        const qty = Number(detailsMap[`qty#${idx}`] || detailsMap[`qty_return#${idx}`] || detailsMap[`stok_qty_plus#${idx}`] || detailsMap[`stok_qty_min#${idx}`] || detailsMap[`actual_qty#${idx}`] || 0);

        if (!inventoryMap.has(pUuid)) {
          inventoryMap.set(pUuid, { 
            uuid: pUuid, 
            name: pName, 
            unit: unit,
            stockIn: 0, 
            stockOut: 0, 
            adjustment: 0, 
            finalStock: 0 
          });
        }

        const item = inventoryMap.get(pUuid);

        // Update nilai berdasarkan jenis transaksi
        if (j.code.startsWith('BUY') || j.code.startsWith('RET_SALE') || j.code.startsWith('STOCK_IN')) {
          item.stockIn += qty;
        } else if (j.code.startsWith('SALE') || j.code.startsWith('RET_BUY') || j.code.startsWith('STOCK_OUT')) {
          item.stockOut += qty;
        } else if (j.code.startsWith('ADJ') || j.code.startsWith('OPN')) {
            // Logika adjustment/opname biasanya menyimpan selisih
            // Jika ada stok_qty_plus, berarti nambah. Jika stok_qty_min berarti kurang.
            if (detailsMap.hasOwnProperty(`stok_qty_plus#${idx}`)) {
                 item.adjustment += qty;
            } else if (detailsMap.hasOwnProperty(`stok_qty_min#${idx}`)) {
                 item.adjustment -= qty;
            } else if (detailsMap.hasOwnProperty(`difference#${idx}`)) {
                 item.adjustment += Number(detailsMap[`difference#${idx}`]);
            }
        }
        
        idx++; // Lanjut ke item berikutnya di jurnal ini
      }
    });

    return Array.from(inventoryMap.values()).map(item => ({
      ...item,
      finalStock: item.stockIn - item.stockOut + item.adjustment
    }));
  }

  async getStockMovementChart(storeUuid: string, startDate: string, endDate: string) {
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

    journals.forEach(j => {
      const dateKey = j.createdAt.toISOString().split('T')[0];
      
      if (!chartMap.has(dateKey)) {
        chartMap.set(dateKey, { date: dateKey, masuk: 0, keluar: 0 });
      }
      
      const entry = chartMap.get(dateKey);
      
      j.details.forEach(detail => {
        if (detail.key.startsWith('qty#') || detail.key.startsWith('qty_return#') || detail.key === 'qty') {
          const qtyValue = Number(detail.value || 0);

          if (j.code.includes('BUY') || j.code.includes('RET_SALE')) {
            entry.masuk += qtyValue;
          } 
          else if (j.code.includes('SALE') || j.code.includes('RET_BUY')) {
            entry.keluar += qtyValue;
          }
        }
      });
    });

    const result = Array.from(chartMap.values());
    
    return result;
  }
}