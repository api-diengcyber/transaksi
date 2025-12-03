import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, EntityManager, Like } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';

// [BARU] Helper untuk menghasilkan pengenal lokal
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
    
    // Logika untuk mencari urutan tertinggi di toko yang sama
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
    
    if (!storeUuid) {
        throw new BadRequestException('Store ID is required for journal creation.');
    }
    
    const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;

    return this.dataSource.transaction(async (manager) => {
      const code = await this.generateCode(type, storeUuid);
      const journal = manager.create(JournalEntity, {
        uuid: customJournalUuid,
        code,
        createdBy: userId,
      });
      await manager.save(journal);

      const detailEntities = Object.entries(details).map(([key, value]) =>
        manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          journalCode: code,
          createdBy: userId,
        }),
      );

      // 1. Simpan semua detail non-stock yang dikirim dari frontend
      await manager.save(detailEntities);

      // 2. Proses Stock dan Nominal (SALE, BUY, RT_SALE, RT_BUY)
      if (['SALE', 'BUY', 'RT_SALE', 'RT_BUY'].includes(type)) { 
        await this.processStockAndNominal(details, userId, manager, code, type as any, storeUuid);
      }

      // 3. Proses Debt/Credit (Piutang/Hutang saat SALE/BUY Kredit)
      if (details.is_credit === 'true' && (type === 'SALE' || type === 'BUY')) {
            await this.processCreditSaleAndBuyNominal(details, userId, manager, code, type as any, storeUuid);
      }
      
      // [BARU] 4. Proses Pembuatan Piutang/Hutang Global (AR dan AP)
      if (['AR', 'AP'].includes(type)) {
          await this.processGlobalDebtNominal(details, userId, manager, code, type as any, storeUuid);
      }
      
      // [BARU] 5. Proses Pembayaran Piutang/Hutang (PAY_AR dan PAY_AP)
      if (['PAY_AR', 'PAY_AP'].includes(type)) {
          await this.processPaymentNominal(details, userId, manager, code, type as any, storeUuid);
      }


      return {
        message: `${type} journal created`,
        journal,
        details: detailEntities,
      };
    });
  }

  // --- Processors ---
  
  /**
   * Mengkonversi item dari payload transaksi BUY/SALE/RETUR menjadi entry Journal Detail
   * untuk pencatatan stok dan nominal.
   */
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

    // 1. Rekonstruksi Item Details berdasarkan index
    Object.keys(details).forEach((key) => {
      if (key.includes('#')) {
        const parts = key.split('#');
        const index = parts.pop();
        const fieldName = parts.join('#');

        if (!index || isNaN(Number(index))) return;

        if (!itemsMap.has(index)) {
          itemsMap.set(index, {});
        }
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
        case 'SALE':
            stockPrefix = 'stok_min_'; 
            nominalPrefix = 'nominal_sale_';
            break;
        case 'BUY':
            stockPrefix = 'stok_plus_';
            nominalPrefix = 'nominal_buy_';
            break;
        case 'RT_SALE': // Retur Penjualan (menambah stok)
            stockPrefix = 'stok_plus_'; 
            nominalPrefix = 'nominal_sale_'; 
            break;
        case 'RT_BUY': // Retur Pembelian (mengurangi stok)
            stockPrefix = 'stok_min_'; 
            nominalPrefix = 'nominal_buy_'; 
            break;
        default:
            // This should not happen if called correctly
            const _exhaustiveCheck: never = type;
            throw new BadRequestException('Invalid journal type for stock operation');
    }

    // 2. Buat Journal Detail Entries untuk Stok dan Nominal
    for (const [_, item] of itemsMap) {
      if (item.productUuid && item.qty > 0 && item.unitUuid && item.price !== undefined) {

        // 2a. Catat Pergerakan Stok
        const stockKey = `${stockPrefix}${item.productUuid}_${item.unitUuid}`;
        journalDetails.push(manager.create(JournalDetailEntity, {
          uuid: generateJournalDetailUuid(storeUuid),
          journalCode: journalCode,
          key: stockKey,
          value: String(item.qty),
          createdBy: userId,
        }));

        // 2b. Catat Nominal
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
    * Mencatat nominal Piutang (nominal_ar) atau Hutang (nominal_ap) untuk transaksi SALE/BUY kredit.
    */
  private async processCreditSaleAndBuyNominal(
        details: Record<string, any>,
        userId: string | undefined,
        manager: EntityManager,
        journalCode: string,
        type: 'SALE' | 'BUY',
        storeUuid: string,
    ) {
        const grandTotal = Number(details['grand_total'] || 0);
        if (grandTotal <= 0) return;

        let debtKey: 'nominal_ar' | 'nominal_ap';
        
        // Piutang Penjualan (AR) terjadi saat SALE kredit.
        if (type === 'SALE') {
            debtKey = 'nominal_ar';
        } 
        // Hutang Pembelian (AP) terjadi saat BUY kredit.
        else if (type === 'BUY') {
            debtKey = 'nominal_ap';
        } else {
            return; 
        }
        
        // Catat Piutang/Hutang sejumlah Grand Total
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey,
            value: String(grandTotal),
            createdBy: userId,
        }));
        
        // Simpan info tanggal jatuh tempo jika ada
        if (details.due_date) {
            await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'due_date',
                value: String(details.due_date),
                createdBy: userId,
            }));
        }
        
        // Simpan info Customer/Supplier jika belum ada di detail lain
        if (type === 'SALE' && details.customer_name) {
            await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'customer_name',
                value: String(details.customer_name),
                createdBy: userId,
            }));
        } else if (type === 'BUY' && details.supplier) {
             await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'supplier',
                value: String(details.supplier),
                createdBy: userId,
            }));
        }
    }
    
    /**
      * [BARU] Mencatat nominal Piutang Global (nominal_ar_global) atau Hutang Global (nominal_ap_global).
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
        
        if (type === 'AR') {
            debtKey = 'nominal_ar_global';
        } else if (type === 'AP') {
            debtKey = 'nominal_ap_global';
        } else {
            return; 
        }
        
        // Catat Piutang/Hutang Global sejumlah Amount
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey,
            value: String(amount),
            createdBy: userId,
        }));
        
        // Simpan info tanggal jatuh tempo jika ada
        if (details.due_date) {
            await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'due_date',
                value: String(details.due_date),
                createdBy: userId,
            }));
        }
        
        // Simpan info Customer/Supplier (contactName)
        if (details.customer_name) {
            await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'customer_name',
                value: String(details.customer_name),
                createdBy: userId,
            }));
        } else if (details.supplier) {
             await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'supplier',
                value: String(details.supplier),
                createdBy: userId,
            }));
        }
    }

  /**
    * Mencatat transaksi pembayaran Piutang (PAY_AR) atau Hutang (PAY_AP).
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
        
        if (type === 'PAY_AR') {
            debtKey = 'nominal_ar_paid';
        } else if (type === 'PAY_AP') {
            debtKey = 'nominal_ap_paid';
        } else {
            return; 
        }
        
        // Catat jumlah yang dibayarkan/diterima
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: debtKey,
            value: String(amount),
            createdBy: userId,
        }));
        
        // Catat referensi nota yang dibayar (Wajib)
        if (!details.reference_journal_code) {
             throw new BadRequestException('Reference journal code is required for payment transaction.');
        }
        await manager.save(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            journalCode: journalCode,
            key: 'reference_journal_code',
            value: String(details.reference_journal_code),
            createdBy: userId,
        }));
        
        // Catat nama Pelanggan/Supplier (jika ada)
        if (details.customer_name) {
            await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'customer_name',
                value: String(details.customer_name),
                createdBy: userId,
            }));
        } else if (details.supplier) {
             await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'supplier',
                value: String(details.supplier),
                createdBy: userId,
            }));
        }
        
        // Simpan info metode pembayaran
        if (details.payment_method) {
             await manager.save(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                journalCode: journalCode,
                key: 'payment_method',
                value: String(details.payment_method),
                createdBy: userId,
            }));
        }
    }


  // ==========================================================
  // Stock Adjustment via Product Create/Update (Type: ADJ)
  // ==========================================================
  /**
   * Mencatat penyesuaian stok (selisih newQty dan oldQty) sebagai transaksi ADJ.
   */
  async processStockAdjustment(
    adjustments: Array<{ productUuid: string; unitUuid: string; oldQty: number; newQty: number; }>,
    userId: string | undefined,
    manager: EntityManager,
    storeUuid: string,
  ) {
    if (!adjustments || adjustments.length === 0) return;

    const journalDetails: Partial<JournalDetailEntity>[] = [];
    const code = await this.generateCode('ADJ', storeUuid);
    const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;

    // 1. Buat Journal entry untuk adjustment
    const journal = manager.create(JournalEntity, {
      uuid: customJournalUuid,
      code,
      createdBy: userId,
    });
    await manager.save(journal);

    // 2. Catat detail penyesuaian untuk setiap unit
    for (const adj of adjustments) {
      const diff = adj.newQty - adj.oldQty;

      if (diff === 0) continue;

      const stockPrefix = diff > 0 ? 'stok_plus_' : 'stok_min_';
      const qty = Math.abs(diff);

      // Key format: stok_(plus/min)_UUIDPRODUK_UUIDUNIT
      const stockKey = `${stockPrefix}${adj.productUuid}_${adj.unitUuid}`;

      journalDetails.push(manager.create(JournalDetailEntity, {
        uuid: generateJournalDetailUuid(storeUuid),
        journalCode: code,
        key: stockKey,
        value: String(qty),
        createdBy: userId,
      }));

      // Catat juga metadata adjustment untuk audit/laporan
      const metaKey = `stok_adj_meta_${adj.productUuid}_${adj.unitUuid}`;
      journalDetails.push(manager.create(JournalDetailEntity, {
        uuid: generateJournalDetailUuid(storeUuid),
        journalCode: code,
        key: metaKey,
        value: JSON.stringify({ diff: diff, old: adj.oldQty, new: adj.newQty }),
        createdBy: userId,
      }));
    }

    if (journalDetails.length > 0) {
      await manager.save(journalDetails);
    }
  }

  async createSale(details: any, userId: string, storeUuid: string) {
    return this.createJournal('SALE', details, userId, storeUuid);
  }

  async createBuy(details: any, userId: string, storeUuid: string) {
    return this.createJournal('BUY', details, userId, storeUuid);
  }
  
  // [BARU] Retur Penjualan
  async createSaleReturn(details: any, userId: string, storeUuid: string) {
    return this.createJournal('RT_SALE', details, userId, storeUuid);
  }

  // [BARU] Retur Pembelian
  async createBuyReturn(details: any, userId: string, storeUuid: string) {
    return this.createJournal('RT_BUY', details, userId, storeUuid);
  }
  
  // [BARU] Piutang Global
  async createAr(details: any, userId: string, storeUuid: string) {
    return this.createJournal('AR', details, userId, storeUuid);
  }
  
  // [BARU] Hutang Global
  async createAp(details: any, userId: string, storeUuid: string) {
    return this.createJournal('AP', details, userId, storeUuid);
  }

  // [BARU] Pembayaran Piutang
  async createArPayment(details: any, userId: string, storeUuid: string) {
    return this.createJournal('PAY_AR', details, userId, storeUuid);
  }

  // [BARU] Pembayaran Hutang
  async createApPayment(details: any, userId: string, storeUuid: string) {
    return this.createJournal('PAY_AP', details, userId, storeUuid);
  }


  async findAllByType(typePrefix: string, storeUuid: string) {
    const codePattern = `${typePrefix}-${storeUuid}-%`;
    return await this.journalRepository.find({
      where: {
        code: Like(`${codePattern}%`),
      },
      relations: ['details'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getChartData(startDate: string, endDate: string, storeUuid: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const saleCodePattern = `SALE-${storeUuid}-%`;
    const buyCodePattern = `BUY-${storeUuid}-%`;
    const returnSaleCodePattern = `RT_SALE-${storeUuid}-%`;
    const returnBuyCodePattern = `RT_BUY-${storeUuid}-%`;
    
    // NOTE: Logika ini HARUS diupdate untuk menyertakan RT_SALE dan RT_BUY jika ingin grafik yang akurat
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