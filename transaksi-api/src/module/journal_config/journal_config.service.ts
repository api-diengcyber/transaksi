import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { JournalConfigEntity } from 'src/common/entities/journal_config/journal_config.entity';
import { CreateJournalConfigDto } from './dto/create-journal-config.dto';
import { AccountEntity } from 'src/common/entities/account/account.entity';
import { generateJournalConfigUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalConfigService {
  constructor(
    @Inject('JOURNAL_CONFIG_REPOSITORY')
    private readonly repo: Repository<JournalConfigEntity>,
    @Inject('DATA_SOURCE') private dataSource: DataSource
  ) {}

  async getDiscovery(storeUuid: string, prefix?: string) {
    // 1. Update Query: Tambahkan SUM(CAST(jd.value AS DECIMAL))
    let sql = `
      SELECT 
        ANY_VALUE(j.code) as code,
        SUBSTRING_INDEX(j.code, '-', 1) as transactionType,
        jd.key as detailKey,
        COUNT(jd.uuid) as frequency,
        SUM(CAST(jd.value AS DECIMAL(20, 2))) as totalValue
      FROM journal_detail jd
      JOIN journal j ON j.code = jd.journal_code
      WHERE j.code LIKE '%-%-%-%' 
      AND jd.value REGEXP '^-?[0-9]+(\.[0-9]+)?$'
    `;

    const params: any[] = [];
    if (prefix) {
      sql += ` AND jd.key LIKE ? `;
      params.push(`${prefix}%`);
    }

    sql += ` GROUP BY transactionType, detailKey ORDER BY transactionType, detailKey`;
    
    // Eksekusi query raw
    const discovered = await this.dataSource.query(sql, params);

    // 2. Ambil Config yang sudah ada
    const existingConfigs = await this.repo.find({
      where: { storeUuid },
      relations: ['account']
    });

    // 3. Mapping result
    return discovered.map((item: any) => {
      // Cari config Exact Match
      let matches = existingConfigs.filter(c => 
        (c.transactionType === item.transactionType || item.transactionType.split('-')[0] === "MANUAL") && 
        c.detailKey === item.detailKey
      );

      let isWildcard = false;

      // Jika tidak ada, cari Wildcard Match
      if (matches.length === 0) {
        matches = existingConfigs.filter(c => 
          (c.transactionType === item.transactionType || item.transactionType.split('-')[0] === "MANUAL") && 
          c.detailKey.endsWith('_') && 
          item.detailKey.startsWith(c.detailKey)
        );
        if (matches.length > 0) isWildcard = true;
      }

      return {
        ...item,
        // Pastikan totalValue dikirim sebagai number (kadang driver mengembalikan string untuk decimal)
        totalValue: Number(item.totalValue || 0),
        isMapped: matches.length > 0,
        isWildcard,
        configs: matches.map(m => ({
            uuid: m.uuid,
            accountName: m.account?.name,
            accountCode: m.account?.code,
            accountUuid: m.accountUuid,
            position: m.position,
            detailKeySource: m.detailKey
        }))
      };
    });
  }

  // ... method findAll, create, remove tetap sama ...
  async findAll(storeUuid: string) {
    return await this.repo.find({
      where: { storeUuid },
      order: { transactionType: 'ASC', detailKey: 'ASC', position: 'ASC' },
      relations: ['account']
    });
  }

  async create(dto: CreateJournalConfigDto, userId: string, storeUuid: string) {
    return this.dataSource.transaction(async (manager) => {
        await manager.delete(JournalConfigEntity, {
            storeUuid,
            transactionType: dto.transactionType,
            detailKey: dto.detailKey
        });

        const entities = dto.items.map(item => {
            return this.repo.create({
                uuid: `${storeUuid}-CFG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                storeUuid,
                transactionType: dto.transactionType,
                detailKey: dto.detailKey,
                position: item.position,
                accountUuid: item.accountUuid,
                createdBy: userId
            });
        });

        if (entities.length > 0) {
            return await manager.save(JournalConfigEntity, entities);
        }
        return [];
    });
  }

  async remove(uuid: string, userId: string) {
    const item = await this.repo.findOne({ where: { uuid } });
    if (!item) throw new NotFoundException('Config not found');
    item.deletedBy = userId;
    item.deletedAt = new Date();
    return await this.repo.save(item);
  }
  
  async installJournalConfigs(manager: EntityManager, storeUuid: string, userId: string) {
    const rawConfigs: any[] = [
      // ==========================================
      // 1. TRANSAKSI PENJUALAN (SALE)
      // ==========================================
      {
        transactionType: "SALE",
        detailKey: "grand_total",
        description: "Pencatatan Pendapatan Penjualan",
        items: [
          { accountCode: "1001", position: "DEBIT" },  // Kas / Bank
          { accountCode: "4001", position: "CREDIT" }  // Pendapatan Penjualan
        ]
      },

      // ==========================================
      // 2. ACCOUNT RECEIVABLE (PIUTANG / AR)
      // ==========================================
      {
        transactionType: "AR",
        detailKey: "amount",
        description: "Penerimaan Pembayaran Piutang",
        items: [
          { accountCode: "1001", position: "DEBIT" },  // Kas / Bank Bertambah
          { accountCode: "1101", position: "CREDIT" }  // Piutang Usaha Berkurang
        ]
      },
      {
        transactionType: "AR",
        detailKey: "dp_amount",
        description: "Penerimaan DP / Uang Muka Penjualan",
        items: [
          { accountCode: "1001", position: "DEBIT" },  // Kas / Bank Bertambah
          { accountCode: "2101", position: "CREDIT" }  // Pendapatan Diterima Dimuka (Uang Muka)
        ]
      },

      // ==========================================
      // 3. ACCOUNT PAYABLE (HUTANG / AP)
      // ==========================================
      {
        transactionType: "AP",
        detailKey: "amount",
        description: "Pembayaran / Pelunasan Hutang",
        items: [
          { accountCode: "2001", position: "DEBIT" },  // Hutang Usaha Berkurang
          { accountCode: "1001", position: "CREDIT" }  // Kas / Bank Berkurang
        ]
      },
      {
        transactionType: "AP",
        detailKey: "dp_amount",
        description: "Pembayaran DP / Uang Muka Pembelian",
        items: [
          { accountCode: "1102", position: "DEBIT" },  // Uang Muka Pembelian Bertambah (Aset)
          { accountCode: "1001", position: "CREDIT" }  // Kas / Bank Berkurang
        ]
      },

      // ==========================================
      // 4. TRANSAKSI PEMBELIAN (BUY)
      // ==========================================
      {
        transactionType: "BUY",
        detailKey: "grand_total",
        description: "Pencatatan Nilai Pembelian Barang",
        items: [
          { accountCode: "1201", position: "DEBIT" },  // Persediaan Barang Bertambah (atau 5001 Pembelian)
          { accountCode: "1001", position: "CREDIT" }  // Kas / Bank Berkurang (Atau 2001 Hutang Usaha)
        ]
      },
      
      // ==========================================
      // 5. TRANSAKSI RETUR PEMBELIAN (RET_BUY)
      // ==========================================
      {
        transactionType: "RET_BUY",
        detailKey: "grand_total",
        description: "Penerimaan Dana Refund dari Supplier",
        items: [
          { accountCode: "1001", position: "DEBIT" },  // Kas Masuk (Refund)
          { accountCode: "1201", position: "CREDIT" }  // Persediaan Berkurang
        ]
      }
    ];
    
    // 1. Tarik semua akun yang baru terbuat di toko ini
    const storeAccounts = await manager.find(AccountEntity, { where: { storeUuid } });

    const configEntities: any[] = [];
    
    // 2. Loop dan buat data Mapping
    for (const config of rawConfigs) {
        for (const item of config.items) {
             // Pastikan storeAccounts memiliki code yang sama dengan yang didaftarkan di array di atas
             const matchedAccount = storeAccounts.find(acc => acc.code === item.accountCode);
             
             if (matchedAccount) {
                 configEntities.push(manager.create(JournalConfigEntity, {
                     uuid: generateJournalConfigUuid(storeUuid),
                     storeUuid: storeUuid,
                     transactionType: config.transactionType,
                     detailKey: config.detailKey,
                     accountUuid: matchedAccount.uuid,
                     position: item.position,
                     createdBy: userId
                 }));
             } else {
                 console.warn(`[Install Journal Config] Account code ${item.accountCode} not found for Store ${storeUuid}`);
             }
        }
    }
    
    // 3. Simpan
    if (configEntities.length > 0) {
        await manager.save(JournalConfigEntity, configEntities);
    }
  }
}