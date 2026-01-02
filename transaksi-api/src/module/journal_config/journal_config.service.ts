import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
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
    // 1. Bangun Query Dynamic
    let sql = `
      SELECT 
        SUBSTRING_INDEX(j.code, '-', 1) as transactionType,
        jd.key as detailKey,
        COUNT(jd.uuid) as frequency
      FROM journal_detail jd
      JOIN journal j ON j.code = jd.journal_code
      WHERE j.code LIKE '%-%-%-%' 
    `;

    const params: any[] = [];

    // Filter berdasarkan prefix jika ada (contoh: 'ac_')
    if (prefix) {
      sql += ` AND jd.key LIKE ? `;
      params.push(`${prefix}%`);
    }

    sql += ` GROUP BY transactionType, detailKey ORDER BY transactionType, detailKey`;

    const discovered = await this.dataSource.query(sql, params);

    // 2. Ambil Config yang sudah ada
    const existingConfigs = await this.repo.find({
      where: { storeUuid },
      relations: ['account']
    });

    // 3. Mapping status (Apakah key ini sudah ada aturannya?)
    return discovered.map((item: any) => {
      // Cek Exact Match
      let match = existingConfigs.find(c => 
        c.transactionType === item.transactionType && 
        c.detailKey === item.detailKey
      );

      // Cek Wildcard Match (jika config pake underscore di akhir, misal stok_min_)
      if (!match) {
        match = existingConfigs.find(c => 
          c.transactionType === item.transactionType && 
          c.detailKey.endsWith('_') && 
          item.detailKey.startsWith(c.detailKey)
        );
      }

      return {
        ...item,
        isMapped: !!match,
        mappedAccount: match?.account?.name || null,
        mappedPosition: match?.position || null,
        configUuid: match?.uuid || null 
      };
    });
  }

  async findAll(storeUuid: string) {
    return await this.repo.find({
      where: { storeUuid },
      order: { transactionType: 'ASC', position: 'ASC' },
      relations: ['account']
    });
  }

  async create(dto: CreateJournalConfigDto, userId: string, storeUuid: string) {
    const uuid = `${storeUuid}-CFG-${Date.now()}`;
    const entity = this.repo.create({
      ...dto,
      uuid,
      storeUuid,
      createdBy: userId,
    });
    return await this.repo.save(entity);
  }

  async remove(uuid: string, userId: string) {
    const item = await this.repo.findOne({ where: { uuid } });
    if (!item) throw new NotFoundException('Config not found');
    item.deletedBy = userId;
    item.deletedAt = new Date();
    return await this.repo.save(item);
  }
}