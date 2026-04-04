import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalApService {
  constructor(
    private readonly journalService: JournalService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  // 1. FUNGSI UNTUK MENCATAT HUTANG BARU / MANUAL
  async createAp(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('AP', storeUuid); // Kode berawalan AP
        
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);

        const detailEntities: JournalDetailEntity[] = [];

        // PENGAMANAN: Buka bungkus detail jika dari frontend terkirim berlapis
        const dataDetails = details?.details ? details.details : details;

        Object.entries(dataDetails).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
  
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          // Pengamanan agar tidak Error Data Too Long
          if (valStr.length > 250) valStr = valStr.substring(0, 250);

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        if (detailEntities.length > 0) await manager.save(detailEntities);
        return { message: 'AP journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  // 2. FUNGSI UNTUK MENCATAT PELUNASAN / PEMBAYARAN HUTANG
  async payAp(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('PAY_AP', storeUuid); // Kode berawalan PAY_AP
        
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);

        const detailEntities: JournalDetailEntity[] = [];

        // Buka bungkus payload
        const dataDetails = details?.details ? details.details : details;

        // Menambahkan properti "nominal_ap_paid" agar bisa ditangkap oleh Computed di Frontend (ap/index.vue)
        if (dataDetails.amount) {
            dataDetails.nominal_ap_paid = dataDetails.amount;
        }

        Object.entries(dataDetails).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
  
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          if (valStr.length > 250) valStr = valStr.substring(0, 250);

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        if (detailEntities.length > 0) await manager.save(detailEntities);
        return { message: 'AP Payment journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }
}