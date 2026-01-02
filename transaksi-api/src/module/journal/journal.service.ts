import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, EntityManager, Like } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { StoreEntity } from 'src/common/entities/store/store.entity';

const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const generateJournalDetailUuid = (storeUuid: string) => `${storeUuid}-JDT-${generateLocalUuid()}`;

@Injectable()
export class JournalService {
  constructor(
    @Inject('JOURNAL_REPOSITORY')
    private journalRepository: Repository<JournalEntity>,
    @Inject('JOURNAL_DETAIL_REPOSITORY')
    private detailRepository: Repository<JournalDetailEntity>,
    @Inject('DATA_SOURCE')
    private dataSource: DataSource,
  ) { }

  async generateCode(prefix: string, storeUuid: string) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const codePrefix = `${prefix}-${storeUuid}-${date}-`;
    const maxCodeJournal = await this.journalRepository.findOne({
        where: { code: Like(`${codePrefix}%`) },
        order: { code: 'DESC' },
    });
    let sequence = 1;
    if (maxCodeJournal) {
        const lastPart = maxCodeJournal.code.split('-').pop();
        if (lastPart) sequence = parseInt(lastPart) + 1;
    }
    return `${codePrefix}${String(sequence).padStart(4, '0')}`;
  }

  async createJournal(type: string, details: Record<string, any>, userId: string, storeUuid: string) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');
    
    const isMirror = details.is_mirror_transaction === true;
    const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;

    return this.dataSource.transaction(async (manager) => {
      const code = await this.generateCode(type, storeUuid);
      const journal = manager.create(JournalEntity, {
        uuid: customJournalUuid,
        code,
        createdBy: userId,
      });
      await manager.save(journal);

      const detailEntities: JournalDetailEntity[] = [];

      // 1. Simpan Fields Utama (Header Transaksi)
      Object.entries(details).forEach(([key, value]) => {
        if (['target_store_uuid', 'is_mirror_transaction', 'items'].includes(key)) return; // Skip items array here
        if (value === null || value === undefined) return;

        detailEntities.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          journalCode: code,
          createdBy: userId,
        }));
      });

      // 2. Simpan Detail Items (Explode Array ke Rows)
      // Ini memastikan "semua parameter sampai terkecil" tersimpan sebagai key-value per item
      if (details.items && Array.isArray(details.items)) {
          details.items.forEach((item: any, index: number) => {
              Object.entries(item).forEach(([itemKey, itemValue]) => {
                  if (itemValue === null || itemValue === undefined) return;
                  
                  // Konversi key item menjadi format flatten: product_uuid#0, name#0, dst.
                  // Gunakan snake_case untuk key database jika memungkinkan, atau biarkan raw
                  const dbKey = `${this.toSnakeCase(itemKey)}#${index}`;
                  const valStr = typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue);

                  // Pastikan value tidak melebihi kapasitas kolom (opsional: truncate jika perlu)
                  if (valStr.length > 0) {
                      detailEntities.push(manager.create(JournalDetailEntity, {
                          uuid: generateJournalDetailUuid(storeUuid),
                          key: dbKey,
                          value: valStr.length > 500 ? valStr.substring(0, 500) : valStr, // Safety truncate
                          journalCode: code,
                          createdBy: userId,
                      }));
                  }
              });
          });
      }

      if (detailEntities.length > 0) await manager.save(detailEntities);

      const isCredit = String(details.is_credit) === 'true' || details.is_credit === true;

      // Proses Logic Accounting
      if (['SALE', 'BUY', 'RT_SALE', 'RT_BUY'].includes(type)) { 
        await this.processStockAndNominal(details, userId, manager, code, type as any, storeUuid);
      }

      if (isCredit && (type === 'SALE' || type === 'BUY')) {
            await this.processCreditSaleAndBuyNominal(details, userId, manager, code, type as any, storeUuid);
      }
      
      if (['AR', 'AP'].includes(type)) {
          await this.processGlobalDebtNominal(details, userId, manager, code, type as any, storeUuid);
      }
      
      if (['PAY_AR', 'PAY_AP'].includes(type)) {
          await this.processPaymentNominal(details, userId, manager, code, type as any, storeUuid);
      }

      if (details.target_store_uuid && !isMirror) {
          await this.processInterStoreTransaction(type, details, userId, storeUuid, details.target_store_uuid, manager);
      }

      return { message: `${type} journal created`, journal, details: detailEntities };
    });
  }

  // Helper untuk konversi key ke snake_case (opsional, agar rapi di DB)
  private toSnakeCase(str: string) {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private async processStockAndNominal(
    details: Record<string, any>,
    userId: string | undefined,
    manager: EntityManager,
    journalCode: string,
    type: 'SALE' | 'BUY' | 'RT_SALE' | 'RT_BUY',
    storeUuid: string,
  ) {
    const items: any[] = [];

    // [UPDATED] Prioritaskan pembacaan dari array 'items' jika ada
    if (details.items && Array.isArray(details.items)) {
        items.push(...details.items);
    } else {
        // Fallback ke logic lama (parsing key#index) jika API dipanggil cara lama
        const itemsMap = new Map<string, any>();
        Object.keys(details).forEach((key) => {
            if (key.includes('#')) {
                const parts = key.split('#');
                const index = parts.pop();
                const fieldName = parts.join('#');
                if (!index || isNaN(Number(index))) return;
                if (!itemsMap.has(index)) itemsMap.set(index, {});
                const itemObj = itemsMap.get(index);
                if (fieldName === 'product_uuid') itemObj.product_uuid = details[key];
                if (fieldName === 'unit_uuid') itemObj.unit_uuid = details[key];
                if (fieldName === 'qty') itemObj.qty = Number(details[key]);
                if (fieldName === 'price' || fieldName === 'buy_price') itemObj.price = Number(details[key]);
                if (fieldName === 'subtotal') itemObj.subtotal = Number(details[key]);
            }
        });
        items.push(...Array.from(itemsMap.values()));
    }

    let stockPrefix: 'stok_min_' | 'stok_plus_';
    let nominalPrefix: 'nominal_sale_' | 'nominal_buy_';

    switch (type) {
        case 'SALE': stockPrefix = 'stok_min_'; nominalPrefix = 'nominal_sale_'; break;
        case 'BUY': stockPrefix = 'stok_plus_'; nominalPrefix = 'nominal_buy_'; break;
        case 'RT_SALE': stockPrefix = 'stok_plus_'; nominalPrefix = 'nominal_sale_'; break;
        case 'RT_BUY': stockPrefix = 'stok_min_'; nominalPrefix = 'nominal_buy_'; break;
        default: return;
    }

    const journalDetails: Partial<JournalDetailEntity>[] = [];

    for (const item of items) {
      // Pastikan field snake_case atau camelCase tertangani
      const pUuid = item.product_uuid || item.productUuid;
      const uUuid = item.unit_uuid || item.unitUuid;
      const qty = Number(item.qty);
      const price = Number(item.price);
      const subtotal = Number(item.subtotal || (qty * price));

      if (pUuid && qty > 0 && uUuid) {
        // Catat mutasi stok
        const stockKey = `${stockPrefix}${pUuid}_${uUuid}`;
        journalDetails.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: journalCode,
          key: stockKey,
          value: String(qty),
          createdBy: userId,
        }));

        // Catat nominal per item (untuk HPP / Omset per produk)
        const nominalKey = `${nominalPrefix}${pUuid}_${uUuid}`;
        journalDetails.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: journalCode,
          key: nominalKey,
          value: String(subtotal),
          createdBy: userId,
        }));
      }
    }

    if (journalDetails.length > 0) {
      await manager.save(journalDetails);
    }
  }

  // (Method lain: processInterStoreTransaction, processCreditSaleAndBuyNominal, processGlobalDebtNominal, processPaymentNominal, processStockAdjustment, createSale, dll TETAP SAMA seperti kode sebelumnya, tidak perlu diubah kecuali Anda ingin saya tulis ulang full)
  // ... Paste code existing untuk method private lainnya di sini ...
  
  // Method untuk mirroring juga perlu update sedikit agar support array items jika target store support
  private async processInterStoreTransaction(
      sourceType: string, sourceDetails: Record<string, any>, userId: string, sourceStoreUuid: string, targetStoreUuid: string, manager: EntityManager
  ) {
      let targetType = '';
      if (sourceType === 'SALE') targetType = 'BUY';
      else if (sourceType === 'BUY') targetType = 'SALE';
      else if (sourceType === 'RT_SALE') targetType = 'RT_BUY';
      else if (sourceType === 'RT_BUY') targetType = 'RT_SALE';
      else return; 

      const sourceStore = await manager.findOne(StoreEntity, { where: { uuid: sourceStoreUuid }});
      const targetStore = await manager.findOne(StoreEntity, { where: { uuid: targetStoreUuid }});
      if (!sourceStore || !targetStore) return;

      const targetDetails = { ...sourceDetails };
      targetDetails.is_mirror_transaction = true; 
      delete targetDetails.target_store_uuid; 

      if (targetType === 'SALE' || targetType === 'RT_SALE') {
          targetDetails.customer_name = `Toko: ${sourceStore.name}`;
          delete targetDetails.supplier;
      } else {
          targetDetails.supplier = `Toko: ${sourceStore.name}`;
          delete targetDetails.customer_name;
      }

      // Mirroring items is easier now with array
      if (sourceDetails.items) {
          targetDetails.items = sourceDetails.items.map((item: any) => ({ ...item }));
          // Swap price logic if needed (e.g. sale price vs buy price logic), but usually raw copy is enough for mirroring 
          // unless your business logic requires price transformation.
      }
      
      try {
          await this.createJournal(targetType, targetDetails, userId, targetStoreUuid);
      } catch (error) {
          console.error(`Mirroring error to ${targetStore.name}:`, error);
      }
  }

  // Helper Wrappers (Sama)
  async createSale(details: any, userId: string, storeUuid: string) { return this.createJournal('SALE', details, userId, storeUuid); }
  async createBuy(details: any, userId: string, storeUuid: string) { return this.createJournal('BUY', details, userId, storeUuid); }
  async createSaleReturn(details: any, userId: string, storeUuid: string) { return this.createJournal('RT_SALE', details, userId, storeUuid); }
  async createBuyReturn(details: any, userId: string, storeUuid: string) { return this.createJournal('RT_BUY', details, userId, storeUuid); }
  async createAr(details: any, userId: string, storeUuid: string) { return this.createJournal('AR', details, userId, storeUuid); }
  async createAp(details: any, userId: string, storeUuid: string) { return this.createJournal('AP', details, userId, storeUuid); }
  async createArPayment(details: any, userId: string, storeUuid: string) { return this.createJournal('PAY_AR', details, userId, storeUuid); }
  async createApPayment(details: any, userId: string, storeUuid: string) { return this.createJournal('PAY_AP', details, userId, storeUuid); }
  
  async processCreditSaleAndBuyNominal(details: any, userId: any, manager: any, code: any, type: any, storeUuid: any) {
       const value = Number(details['grand_total']) || Number(details['amount']) || 0;
       if (value <= 0) return;
       let debtKey = type === 'SALE' ? 'nominal_ar' : 'nominal_ap';
       await manager.save(manager.create(JournalDetailEntity, { uuid: generateJournalDetailUuid(storeUuid), journalCode: code, key: debtKey, value: String(value), createdBy: userId }));
  }
  async processGlobalDebtNominal(details: any, userId: any, manager: any, code: any, type: any, storeUuid: any) {
       const amount = Number(details['amount'] || 0);
       if (amount <= 0) return;
       let debtKey = type === 'AR' ? 'nominal_ar_global' : 'nominal_ap_global';
       await manager.save(manager.create(JournalDetailEntity, { uuid: generateJournalDetailUuid(storeUuid), journalCode: code, key: debtKey, value: String(amount), createdBy: userId }));
  }
  async processPaymentNominal(details: any, userId: any, manager: any, code: any, type: any, storeUuid: any) {
       const amount = Number(details['amount'] || 0);
       if (amount <= 0) return;
       let debtKey = type === 'PAY_AR' ? 'nominal_ar_paid' : 'nominal_ap_paid';
       await manager.save(manager.create(JournalDetailEntity, { uuid: generateJournalDetailUuid(storeUuid), journalCode: code, key: debtKey, value: String(amount), createdBy: userId }));
       if (!details.reference_journal_code) throw new BadRequestException('Reference journal code is required.');
  }

  // (Sisa findAllByType, getChartData, processStockAdjustment gunakan kode asli)
  async findAllByType(typePrefix: string, storeUuid: string) {
    const codePattern = `${typePrefix}-${storeUuid}-%`;
    return await this.journalRepository.find({ where: { code: Like(`${codePattern}%`) }, relations: ['details'], order: { createdAt: 'DESC' } });
  }
  
  async getChartData(startDate: string, endDate: string, storeUuid: string) {
     const start = new Date(startDate); start.setHours(0, 0, 0, 0);
     const end = new Date(endDate); end.setHours(23, 59, 59, 999);
     const saleCodePattern = `SALE-${storeUuid}-%`; const buyCodePattern = `BUY-${storeUuid}-%`;
     const returnSaleCodePattern = `RT_SALE-${storeUuid}-%`; const returnBuyCodePattern = `RT_BUY-${storeUuid}-%`;
     const query = this.journalRepository.createQueryBuilder('j')
      .innerJoin('j.details', 'jd', 'jd.key = :key', { key: 'grand_total' })
      .where('j.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere(`j.code LIKE :saleCodePattern OR j.code LIKE :buyCodePattern OR j.code LIKE :returnSaleCodePattern OR j.code LIKE :returnBuyCodePattern`, { saleCodePattern, buyCodePattern, returnSaleCodePattern, returnBuyCodePattern })
      .select([ "DATE_FORMAT(j.created_at, '%Y-%m-%d') as date", `SUM(CASE WHEN j.code LIKE :saleCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_sale`, `SUM(CASE WHEN j.code LIKE :buyCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_buy`, `SUM(CASE WHEN j.code LIKE :returnSaleCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_rt_sale`, `SUM(CASE WHEN j.code LIKE :returnBuyCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_rt_buy` ])
      .groupBy("date").orderBy("date", "ASC");
    return await query.getRawMany();
  }
  
  async processStockAdjustment(adjustments: any[], userId: string, manager: EntityManager, storeUuid: string) { /* Kode asli */ }
}