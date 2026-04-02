// transaksi-api/src/module/journal/journal.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, Like, EntityManager, Between } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalService {
  constructor(
    @Inject('JOURNAL_REPOSITORY')
    private journalRepository: Repository<JournalEntity>,
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

  // Generic Create Journal (Core Logic)
  async createJournal(type: string, details: Record<string, any>, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        
        const code = await this.generateCode(type, storeUuid);
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);
  
        const detailEntities: JournalDetailEntity[] = [];
  
        Object.entries(details).forEach(([key, value]) => {
          if (key === 'items') return; 
          if (value === null || value === undefined) return;
  
          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
            journalCode: code,
            createdBy: userId,
          }));
        });
  
        if (details.items && Array.isArray(details.items)) {
            details.items.forEach((item: any, index: number) => {
                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.toSnakeCase(itemKey)}#${index}`;
                    const valStr = typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue);
  
                    if (valStr.length > 0) {
                        detailEntities.push(manager.create(JournalDetailEntity, {
                            uuid: generateJournalDetailUuid(storeUuid),
                            key: dbKey,
                            value: valStr.length > 500 ? valStr.substring(0, 500) : valStr, 
                            journalCode: code,
                            createdBy: userId,
                        }));
                    }
                });
            });
        }
  
        if (detailEntities.length > 0) await manager.save(detailEntities);
  
        return { message: `${type} journal created`, journal, details: detailEntities };
    };

    if (externalManager) {
        return await work(externalManager);
    } else {
        return await this.dataSource.transaction(work);
    }
  }

  async verifyJournal(code: string, userId: string) {
    const journal = await this.journalRepository.findOne({ where: { code } });
    if (!journal) throw new BadRequestException('Journal not found');
    journal.verifiedBy = userId;
    journal.verifiedAt = new Date();
    await this.journalRepository.save(journal);
    return { message: 'Journal verified successfully', journal };
  }

  private toSnakeCase(str: string) {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async findAllByType(typePrefix: string, storeUuid: string) {
    const codePattern = `${typePrefix}-${storeUuid}-%`;
    return await this.journalRepository.find({ 
        where: { code: Like(`${codePattern}%`) }, 
        relations: ['details'], 
        order: { createdAt: 'DESC' } 
    });
  }

  async getChartData(startDate: string, endDate: string, storeUuid: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const journals = await this.journalRepository.find({
      where: { code: Like(`%-${storeUuid}-%`), createdAt: Between(start, end) },
      relations: ['details'],
      order: { createdAt: 'ASC' },
    });

    const dateMap = new Map<string, any>();
    let currDate = new Date(start);
    while (currDate <= end) {
      const dateStr = currDate.toISOString().split('T')[0];
      dateMap.set(dateStr, { date: dateStr, total_sale: 0, total_buy: 0, total_rt_sale: 0, total_rt_buy: 0 });
      currDate.setDate(currDate.getDate() + 1);
    }

    for (const journal of journals) {
      const dateStr = journal.createdAt.toISOString().split('T')[0];
      const entry = dateMap.get(dateStr);
      if (entry) {
        const amountDetail = journal.details.find(d => d.key === 'amount' || d.key === 'grand_total');
        const amount = amountDetail ? parseFloat(amountDetail.value) || 0 : 0;
        if (journal.code.startsWith('SALE-')) entry.total_sale += amount;
        else if (journal.code.startsWith('BUY-')) entry.total_buy += amount;
        else if (journal.code.startsWith('RETURN_SALE-')) entry.total_rt_sale += amount;
        else if (journal.code.startsWith('RETURN_BUY-')) entry.total_rt_buy += amount;
      }
    }
    return Array.from(dateMap.values());
  }
}