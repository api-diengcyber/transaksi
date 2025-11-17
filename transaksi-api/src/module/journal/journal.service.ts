import { Injectable, Inject } from '@nestjs/common';
import { Repository, DataSource, EntityManager, Like } from 'typeorm'; // Tambahkan EntityManager
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { ProductService } from '../product/product.service';

@Injectable()
export class JournalService {
  constructor(
    @Inject('JOURNAL_REPOSITORY')
    private journalRepository: Repository<JournalEntity>,

    @Inject('JOURNAL_DETAIL_REPOSITORY')
    private detailRepository: Repository<JournalDetailEntity>,
    
    private readonly productService: ProductService,

    @Inject('DATA_SOURCE')
    private dataSource: DataSource,
  ) {}

  async generateCode(prefix: string) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.journalRepository.count();
    return `${prefix}-${date}-${String(count + 1).padStart(4, '0')}`;
  }

  async createJournal(
    type: string,
    details: Record<string, any>,
    userId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const code = await this.generateCode(type);
      const journal = manager.create(JournalEntity, {
        code,
        createdBy: userId,
      });
      await manager.save(journal);
      const detailEntities = Object.entries(details).map(([key, value]) =>
        manager.create(JournalDetailEntity, {
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          journalCode: code,
          createdBy: userId,
        }),
      );
      await manager.save(detailEntities);
      if (type === 'SALE') {
        await this.productService.processSaleStock(details, userId, manager);
      }
      return {
        message: `${type} journal created`,
        journal,
        details: detailEntities,
      };
    });
  }

  async createSale(details: any, userId: string) {
    return this.createJournal('SALE', details, userId);
  }

  async createBuy(details: any, userId: string) {
    return this.createJournal('BUY', details, userId);
  }
  
  async findAllByType(typePrefix: string) {
    return await this.journalRepository.find({
      where: {
        code: Like(`${typePrefix}%`),
      },
      relations: ['details'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getChartData(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const query = this.journalRepository.createQueryBuilder('j')
      .innerJoin('j.details', 'jd', 'jd.key = :key', { key: 'grand_total' })
      .where('j.createdAt BETWEEN :start AND :end', { start, end })
      .select([
        "DATE_FORMAT(j.created_at, '%Y-%m-%d') as date",
        "SUM(CASE WHEN j.code LIKE 'SALE%' THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_sale",
        "SUM(CASE WHEN j.code LIKE 'BUY%' THEN CAST(jd.value AS DECIMAL) ELSE 0 END) as total_buy"
      ])
      .groupBy("date")
      .orderBy("date", "ASC");
    return await query.getRawMany();
  }

}