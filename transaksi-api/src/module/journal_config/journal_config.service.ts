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
        c.transactionType === item.transactionType && 
        c.detailKey === item.detailKey
      );

      let isWildcard = false;

      // Jika tidak ada, cari Wildcard Match
      if (matches.length === 0) {
        matches = existingConfigs.filter(c => 
          c.transactionType === item.transactionType && 
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
      // TRANSAKSI PENJUALAN (SALE)
      // ==========================================
      {
        "transactionType": "SALE",
        "detailKey": "grand_total",
        "description": "Mengakui Total Pendapatan Penjualan",
        "items": [
          { "accountCode": "4001", "position": "CREDIT" } 
        ]
      },
      {
        "transactionType": "SALE",
        "detailKey": "amount_cash",
        "description": "Kas yang masuk dari Penjualan Tunai Lunas",
        "items": [
          { "accountCode": "1001", "position": "DEBIT" } 
        ]
      },
      {
        "transactionType": "SALE",
        "detailKey": "amount_bank_total",
        "description": "Kas yang masuk dari Transfer",
        "items": [
          { "accountCode": "1002", "position": "DEBIT" } 
        ]
      },
      {
        "transactionType": "SALE",
        "detailKey": "amount_member",
        "description": "Pembayaran Menggunakan Saldo Member",
        "items": [
          { "accountCode": "1001", "position": "DEBIT" } // Masuk sebagai Debit (Asumsi uang member ditampung di kas)
        ]
      },
      /* CATATAN PENTING: 
         - 'amount_credit' DIHAPUS dari SALE. Urusan pengakuan Piutang sepenuhnya dihandle oleh jurnal 'AR'.
         - 'dp_amount' (Jika ada di SALE) DIHAPUS. Urusan penerimaan DP Piutang dihandle oleh jurnal 'AR'.
      */

      // ==========================================
      // TRANSAKSI PEMBELIAN (BUY)
      // ==========================================
      {
        "transactionType": "BUY",
        "detailKey": "grand_total",
        "description": "Total Penambahan Nilai Persediaan",
        "items": [
          { "accountCode": "1201", "position": "DEBIT" } 
        ]
      },
      {
        "transactionType": "BUY",
        "detailKey": "amount_cash",
        "description": "Kas yang keluar untuk Pembelian Lunas",
        "items": [
          { "accountCode": "1001", "position": "CREDIT" } 
        ]
      },
      {
        "transactionType": "BUY",
        "detailKey": "amount_bank",
        "description": "Transfer Bank untuk Pembelian Lunas",
        "items": [
          { "accountCode": "1002", "position": "CREDIT" } 
        ]
      },
      /* CATATAN PENTING: 
         - 'amount_credit' DIHAPUS dari BUY. Urusan pengakuan Hutang sepenuhnya dihandle oleh jurnal 'AP'.
         - 'dp_amount' DIHAPUS dari BUY. Pengeluaran DP Hutang dihandle oleh jurnal 'AP'.
      */

      // ==========================================
      // TRANSAKSI PIUTANG (AR) - TERBIT SAAT PENJUALAN KREDIT
      // ==========================================
      {
        "transactionType": "AR",
        "detailKey": "amount",
        "description": "Pengakuan Sisa Piutang ke Pelanggan",
        "items": [
          { "accountCode": "1101", "position": "DEBIT" }    // Piutang Bertambah (Hanya 1 Sisi, Kreditnya sudah terakui di SALE grand_total)
        ]
      },
      {
        "transactionType": "AR",
        "detailKey": "dp_amount",
        "description": "Penerimaan DP dari Piutang",
        "items": [
          { "accountCode": "1001", "position": "DEBIT" }    // Kas Bertambah dari DP (Hanya 1 Sisi, Kreditnya sudah terakui di SALE grand_total)
        ]
      },

      // ==========================================
      // TRANSAKSI HUTANG (AP) - TERBIT SAAT PEMBELIAN KREDIT
      // ==========================================
      {
        "transactionType": "AP",
        "detailKey": "amount",
        "description": "Pengakuan Sisa Hutang ke Supplier",
        "items": [
          { "accountCode": "2001", "position": "CREDIT" }   // Hutang Bertambah (Hanya 1 Sisi, Debitnya sudah terakui di BUY grand_total)
        ]
      },
      {
        "transactionType": "AP",
        "detailKey": "dp_amount",
        "description": "Pengeluaran Kas untuk DP Hutang",
        "items": [
          { "accountCode": "1001", "position": "CREDIT" }   // Kas Keluar karena DP (Hanya 1 Sisi, Debitnya sudah terakui di BUY grand_total)
        ]
      },

      // ==========================================
      // PEMBAYARAN PIUTANG PELANGGAN (PAY_AR) - TERBIT SAAT PELUNASAN/CICILAN
      // ==========================================
      {
        "transactionType": "PAY_AR",
        "detailKey": "amount",
        "description": "Penerimaan Kas dari Cicilan/Pelunasan Piutang",
        "items": [
          { "accountCode": "1001", "position": "DEBIT" },  // Kas Bertambah
          { "accountCode": "1101", "position": "CREDIT" }  // Piutang Berkurang
        ]
      },

      // ==========================================
      // PEMBAYARAN HUTANG SUPPLIER (PAY_AP) - TERBIT SAAT PELUNASAN/CICILAN
      // ==========================================
      {
        "transactionType": "PAY_AP",
        "detailKey": "amount",
        "description": "Pengeluaran Kas untuk Cicilan/Pelunasan Hutang",
        "items": [
          { "accountCode": "2001", "position": "DEBIT" },  // Hutang Berkurang
          { "accountCode": "1001", "position": "CREDIT" }  // Kas Keluar
        ]
      },

      // ==========================================
      // RETUR PENJUALAN (RET_SALE)
      // ==========================================
      {
        "transactionType": "RET_SALE",
        "detailKey": "grand_total",
        "description": "Pengembalian Dana ke Pelanggan",
        "items": [
          { "accountCode": "4002", "position": "DEBIT" },  // Retur Penjualan (Kontra Revenue)
          { "accountCode": "1001", "position": "CREDIT" }  // Kas Keluar (Refund)
        ]
      },

      // ==========================================
      // RETUR PEMBELIAN (RET_BUY)
      // ==========================================
      {
        "transactionType": "RET_BUY",
        "detailKey": "grand_total",
        "description": "Penerimaan Dana Refund dari Supplier",
        "items": [
          { "accountCode": "1001", "position": "DEBIT" },  // Kas Masuk (Refund)
          { "accountCode": "1201", "position": "CREDIT" }  // Persediaan Berkurang
        ]
      }
    ];
    
    // 1. Tarik semua akun yang baru terbuat di toko ini
    const storeAccounts = await manager.find(AccountEntity, { where: { storeUuid } });

    const configEntities: any[] = [];
    
    // 2. Loop dan buat data Mapping
    for (const config of rawConfigs) {
        for (const item of config.items) {
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
             }
        }
    }
    
    // 3. Simpan
    await manager.save(JournalConfigEntity, configEntities);
  }
}