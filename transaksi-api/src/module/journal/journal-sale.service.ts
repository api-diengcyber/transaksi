// transaksi-api/src/module/journal/journal-sale.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalSaleService {
  constructor(
    private readonly journalService: JournalService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createSale(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('SALE', storeUuid);
        
        // 1. Insert Header
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);

        const detailEntities: JournalDetailEntity[] = [];

        // 2. Insert Detail Parameter
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

        // 3. Insert Items (Looping dinamis)
        if (details.items && Array.isArray(details.items)) {
            details.items.forEach((item: any, index: number) => {
                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.journalService.toSnakeCase(itemKey)}#${index}`;
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
        return { message: 'SALE journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }
}