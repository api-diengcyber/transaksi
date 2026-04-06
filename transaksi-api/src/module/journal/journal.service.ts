// transaksi-api/src/module/journal/journal.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Repository, Like, Between, DataSource } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';

@Injectable()
export class JournalService {
  constructor(
    @Inject('JOURNAL_REPOSITORY')
    private journalRepository: Repository<JournalEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
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

  async verifyJournal(code: string, userId: string) {
    const journal = await this.journalRepository.findOne({ where: { code } });
    if (!journal) throw new BadRequestException('Journal not found');
    journal.verifiedBy = userId;
    journal.verifiedAt = new Date();
    await this.journalRepository.save(journal);
    return { message: 'Journal verified successfully', journal };
  }

  public toSnakeCase(str: string) {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async getChartData(startDate: string, endDate: string, storeUuid: string) {
    const query = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany('journal.details', JournalDetailEntity, 'detail', 'detail.journalCode = journal.code')
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.createdAt BETWEEN :start AND :end', { 
        start: `${startDate} 00:00:00`, 
        end: `${endDate} 23:59:59` 
      })
      .orderBy('journal.createdAt', 'ASC');

    const journals = await query.getMany();

    // Grouping data by date
    const chartMap = new Map();

    journals.forEach((j: any) => {
      const date = j.createdAt.toISOString().split('T')[0];
      if (!chartMap.has(date)) {
        chartMap.set(date, { 
          date, sale: 0, buy: 0, ret_sale: 0, ret_buy: 0, ap: 0, ar: 0 
        });
      }

      const entry = chartMap.get(date);
      const detailsMap = j.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});
      
      // Ambil nilai nominal (grand_total atau amount)
      const value = Number(detailsMap['grand_total'] || detailsMap['amount'] || 0);

      if (j.code.includes('SALE') && !j.code.includes('RET')) entry.sale += value;
      else if (j.code.includes('BUY') && !j.code.includes('RET')) entry.buy += value;
      else if (j.code.includes('RET_SALE')) entry.ret_sale += value;
      else if (j.code.includes('RET_BUY')) entry.ret_buy += value;
      else if (j.code.includes('AP') && !j.code.includes('PAY')) entry.ap += value;
      else if (j.code.includes('AR') && !j.code.includes('PAY')) entry.ar += value;
    });

    return Array.from(chartMap.values());
  }
}