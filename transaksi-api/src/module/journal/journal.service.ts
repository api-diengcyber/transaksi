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
        if (lastPart) {
            sequence = parseInt(lastPart) + 1;
        }
    }
    return `${codePrefix}${String(sequence).padStart(4, '0')}`;
  }

  async createJournal(
    type: string,
    details: Record<string, any>,
    userId: string,
    storeUuid: string,
  ) {
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

      // [PERBAIKAN 1] Loop Utama: Menyimpan SEMUA data input mentah (metadata, customer, dll)
      const detailEntities = Object.entries(details).map(([key, value]) => {
        // Filter field kontrol internal yang tidak perlu disimpan di DB
        if (['target_store_uuid', 'is_mirror_transaction'].includes(key)) return null;
        // Filter nilai null/undefined agar tidak error
        if (value === null || value === undefined) return null;

        return manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          journalCode: code,
          createdBy: userId,
        });
      }).filter(item => item !== null);

      await manager.save(detailEntities);

      // [PERBAIKAN 2] Pengecekan is_credit yang lebih aman (handle boolean true vs string 'true')
      const isCredit = String(details.is_credit) === 'true';

      // Proses Logic Accounting (Stock, Nominal System, Hutang/Piutang)
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

      // Inter-store transaction (Mirroring)
      if (details.target_store_uuid && !isMirror) {
          await this.processInterStoreTransaction(type, details, userId, storeUuid, details.target_store_uuid, manager);
      }

      return {
        message: `${type} journal created`,
        journal,
        details: detailEntities,
      };
    });
  }

  // --- Processors ---
  // (Method processInterStoreTransaction dan processStockAndNominal TIDAK PERLU DIUBAH, sudah OK)

  private async processInterStoreTransaction(
      sourceType: string,
      sourceDetails: Record<string, any>,
      userId: string,
      sourceStoreUuid: string,
      targetStoreUuid: string,
      manager: EntityManager
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

      Object.keys(sourceDetails).forEach((key) => {
          if (sourceType === 'SALE' && key.includes('price#') && !key.includes('buy_price')) {
               const index = key.split('#')[1];
               targetDetails[`buy_price#${index}`] = sourceDetails[key];
          }
          if (sourceType === 'BUY' && key.includes('buy_price#')) {
               const index = key.split('#')[1];
               targetDetails[`price#${index}`] = sourceDetails[key];
          }
      });
      
      try {
          await this.createJournal(targetType, targetDetails, userId, targetStoreUuid);
      } catch (error) {
          console.error(`Mirroring error to ${targetStore.name}:`, error);
      }
  }

  private async processStockAndNominal(
    details: Record<string, any>,
    userId: string | undefined,
    manager: EntityManager,
    journalCode: string,
    type: 'SALE' | 'BUY' | 'RT_SALE' | 'RT_BUY',
    storeUuid: string,
  ) {
    const itemsMap = new Map<string, any>();
    const journalDetails: Partial<JournalDetailEntity>[] = [];

    Object.keys(details).forEach((key) => {
      if (key.includes('#')) {
        const parts = key.split('#');
        const index = parts.pop();
        const fieldName = parts.join('#');

        if (!index || isNaN(Number(index))) return;

        if (!itemsMap.has(index)) itemsMap.set(index, {});
        const itemObj = itemsMap.get(index);

        if (itemObj) {
          if (fieldName === 'product_uuid') itemObj.productUuid = details[key];
          if (fieldName === 'unit_uuid') itemObj.unitUuid = details[key];
          if (fieldName === 'qty') itemObj.qty = Number(details[key]);
          if (fieldName === 'price' || fieldName === 'buy_price') itemObj.price = Number(details[key]);
          if (fieldName === 'subtotal') itemObj.subtotal = Number(details[key]);
        }
      }
    });

    let stockPrefix: 'stok_min_' | 'stok_plus_';
    let nominalPrefix: 'nominal_sale_' | 'nominal_buy_';

    switch (type) {
        case 'SALE': stockPrefix = 'stok_min_'; nominalPrefix = 'nominal_sale_'; break;
        case 'BUY': stockPrefix = 'stok_plus_'; nominalPrefix = 'nominal_buy_'; break;
        case 'RT_SALE': stockPrefix = 'stok_plus_'; nominalPrefix = 'nominal_sale_'; break;
        case 'RT_BUY': stockPrefix = 'stok_min_'; nominalPrefix = 'nominal_buy_'; break;
        default: return;
    }

    for (const [_, item] of itemsMap) {
      if (item.productUuid && item.qty > 0 && item.unitUuid && item.price !== undefined) {
        const stockKey = `${stockPrefix}${item.productUuid}_${item.unitUuid}`;
        journalDetails.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: journalCode,
          key: stockKey,
          value: String(item.qty),
          createdBy: userId,
        }));

        const nominalKey = `${nominalPrefix}${item.productUuid}_${item.unitUuid}`;
        const nominalValue = item.subtotal !== undefined ? item.subtotal : (item.qty * item.price);

        journalDetails.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: journalCode,
          key: nominalKey,
          value: String(nominalValue),
          createdBy: userId,
        }));
      }
    }

    if (journalDetails.length > 0) {
      await manager.save(journalDetails);
    }
  }
  
  /**
    * [PERBAIKAN] Mencatat nominal Piutang/Hutang SISTEM.
    * Hapus penyimpanan 'due_date', 'customer_name', 'supplier' di sini karena 
    * sudah disimpan oleh Loop Utama (Langkah 1) dari `details`.
    */
  private async processCreditSaleAndBuyNominal(
        details: Record<string, any>,
        userId: string | undefined,
        manager: EntityManager,
        journalCode: string,
        type: 'SALE' | 'BUY',
        storeUuid: string,
    ) {
        // Fallback: Jika grand_total tidak dikirim, gunakan amount.
        const value = Number(details['grand_total']) || Number(details['amount']) || 0;
        
        if (value <= 0) return;

        let debtKey: 'nominal_ar' | 'nominal_ap';
        if (type === 'SALE') debtKey = 'nominal_ar';
        else if (type === 'BUY') debtKey = 'nominal_ap';
        else return; 
        
        // HANYA simpan key internal sistem yang tidak dikirim frontend
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey, // Key ini penting untuk laporan hutang/piutang
            value: String(value),
            createdBy: userId,
        }));
        
        // CATATAN: Field 'due_date', 'customer_name', dll TIDAK perlu disimpan lagi disini
        // karena sudah ada di object 'details' dan sudah tersimpan di awal function createJournal.
    }
    
    /**
      * [PERBAIKAN] Mencatat nominal Piutang/Hutang Global (Saldo Awal).
      */
    private async processGlobalDebtNominal(
        details: Record<string, any>,
        userId: string | undefined,
        manager: EntityManager,
        journalCode: string,
        type: 'AR' | 'AP',
        storeUuid: string,
    ) {
        const amount = Number(details['amount'] || 0);
        if (amount <= 0) return;

        let debtKey: 'nominal_ar_global' | 'nominal_ap_global';
        if (type === 'AR') debtKey = 'nominal_ar_global';
        else if (type === 'AP') debtKey = 'nominal_ap_global';
        else return; 
        
        // Simpan key system
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey,
            value: String(amount),
            createdBy: userId,
        }));

        // Hapus penyimpanan redundant (due_date, dll)
    }

  /**
    * [PERBAIKAN] Mencatat transaksi pembayaran.
    */
    private async processPaymentNominal(
        details: Record<string, any>,
        userId: string | undefined,
        manager: EntityManager,
        journalCode: string,
        type: 'PAY_AR' | 'PAY_AP',
        storeUuid: string,
    ) {
        const amount = Number(details['amount'] || 0);
        if (amount <= 0) return;

        let debtKey: 'nominal_ar_paid' | 'nominal_ap_paid';
        if (type === 'PAY_AR') debtKey = 'nominal_ar_paid';
        else if (type === 'PAY_AP') debtKey = 'nominal_ap_paid';
        else return; 
        
        // Simpan key system (nominal pembayaran)
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey,
            value: String(amount),
            createdBy: userId,
        }));
        
        // Validasi Referensi (tetap perlu validasi logic, tapi save-nya sudah di loop utama)
        if (!details.reference_journal_code) {
             throw new BadRequestException('Reference journal code is required.');
        }

        // Hapus penyimpanan redundant (reference_journal_code, payment_method, dll)
        // karena mereka ada di 'details' dan sudah disimpan di awal.
    }

  // ... (Sisa method processStockAdjustment, createSale, findAllByType, dll tetap sama) ...
  // Pastikan menyertakan kode processStockAdjustment, createSale, dll di file asli Anda.
  
  async processStockAdjustment(
    adjustments: Array<{ productUuid: string; unitUuid: string; oldQty: number; newQty: number; }>,
    userId: string | undefined,
    manager: EntityManager,
    storeUuid: string,
  ) {
      // (Kode tetap sama)
      if (!adjustments || adjustments.length === 0) return;
      const journalDetails: Partial<JournalDetailEntity>[] = [];
      const code = await this.generateCode('ADJ', storeUuid);
      const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;

      const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
      });
      await manager.save(journal);

      for (const adj of adjustments) {
          const diff = adj.newQty - adj.oldQty;
          if (diff === 0) continue;
          const stockPrefix = diff > 0 ? 'stok_plus_' : 'stok_min_';
          const qty = Math.abs(diff);
          const stockKey = `${stockPrefix}${adj.productUuid}_${adj.unitUuid}`;

          journalDetails.push(manager.create(JournalDetailEntity, {
              uuid: generateJournalDetailUuid(storeUuid),
              journalCode: code,
              key: stockKey,
              value: String(qty),
              createdBy: userId,
          }));
          const metaKey = `stok_adj_meta_${adj.productUuid}_${adj.unitUuid}`;
          journalDetails.push(manager.create(JournalDetailEntity, {
              uuid: generateJournalDetailUuid(storeUuid),
              journalCode: code,
              key: metaKey,
              value: JSON.stringify({ diff: diff, old: adj.oldQty, new: adj.newQty }),
              createdBy: userId,
          }));
      }
      if (journalDetails.length > 0) await manager.save(journalDetails);
  }

  async createSale(details: any, userId: string, storeUuid: string) { return this.createJournal('SALE', details, userId, storeUuid); }
  async createBuy(details: any, userId: string, storeUuid: string) { return this.createJournal('BUY', details, userId, storeUuid); }
  async createSaleReturn(details: any, userId: string, storeUuid: string) { return this.createJournal('RT_SALE', details, userId, storeUuid); }
  async createBuyReturn(details: any, userId: string, storeUuid: string) { return this.createJournal('RT_BUY', details, userId, storeUuid); }
  async createAr(details: any, userId: string, storeUuid: string) { return this.createJournal('AR', details, userId, storeUuid); }
  async createAp(details: any, userId: string, storeUuid: string) { return this.createJournal('AP', details, userId, storeUuid); }
  async createArPayment(details: any, userId: string, storeUuid: string) { return this.createJournal('PAY_AR', details, userId, storeUuid); }
  async createApPayment(details: any, userId: string, storeUuid: string) { return this.createJournal('PAY_AP', details, userId, storeUuid); }

  async findAllByType(typePrefix: string, storeUuid: string) {
    const codePattern = `${typePrefix}-${storeUuid}-%`;
    return await this.journalRepository.find({
      where: { code: Like(`${codePattern}%`) },
      relations: ['details'],
      order: { createdAt: 'DESC' },
    });
  }
  
  async getChartData(startDate: string, endDate: string, storeUuid: string) {
      // (Kode tetap sama)
     const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const saleCodePattern = `SALE-${storeUuid}-%`;
    const buyCodePattern = `BUY-${storeUuid}-%`;
    const returnSaleCodePattern = `RT_SALE-${storeUuid}-%`;
    const returnBuyCodePattern = `RT_BUY-${storeUuid}-%`;
    
    const query = this.journalRepository.createQueryBuilder('j')
      .innerJoin('j.details', 'jd', 'jd.key = :key', { key: 'grand_total' })
      .where('j.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere(`j.code LIKE :saleCodePattern OR j.code LIKE :buyCodePattern OR j.code LIKE :returnSaleCodePattern OR j.code LIKE :returnBuyCodePattern`, { saleCodePattern, buyCodePattern, returnSaleCodePattern, returnBuyCodePattern })
      .select([
        "DATE_FORMAT(j.created_at, '%Y-%m-%d') as date",
        `SUM(CASE WHEN j.code LIKE :saleCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_sale`,
        `SUM(CASE WHEN j.code LIKE :buyCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_buy`,
        `SUM(CASE WHEN j.code LIKE :returnSaleCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_rt_sale`,
        `SUM(CASE WHEN j.code LIKE :returnBuyCodePattern THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_rt_buy`
      ])
      .groupBy("date")
      .orderBy("date", "ASC");
    return await query.getRawMany();
  }
}