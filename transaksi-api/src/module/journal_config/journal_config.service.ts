import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JournalConfigEntity } from 'src/common/entities/journal_config/journal_config.entity';
import { CreateJournalConfigDto } from './dto/create-journal-config.dto';

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
        SUBSTRING_INDEX(j.code, '-', 1) as transactionType,
        jd.key as detailKey,
        COUNT(jd.uuid) as frequency,
        SUM(CAST(jd.value AS DECIMAL(20, 2))) as totalValue 
      FROM journal_detail jd
      JOIN journal j ON j.code = jd.journal_code
      WHERE j.code LIKE '%-%-%-%' 
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
}