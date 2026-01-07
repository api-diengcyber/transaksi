import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, Like, EntityManager } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';

const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
const generateJournalDetailUuid = (storeUuid: string) => `${storeUuid}-JDT-${generateLocalUuid()}`;

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

  // Wrapper Sale
  async createSale(details: any, userId: string, storeUuid: string) {
    return this.createJournal('SALE', details, userId, storeUuid);
  }

  // [BARU] Process Stock Adjustment dari Product Service
  async processStockAdjustment(adjustments: any[], userId: string, manager: EntityManager, storeUuid: string) {
    if (!adjustments || adjustments.length === 0) return;

    // Mapping adjustments ke format items jurnal
    const items = adjustments.map(adj => {
        const diff = Number(adj.newQty) - Number(adj.oldQty);
        if (diff === 0) return null;

        const item: any = {
            stok_product_uuid: adj.productUuid,
            stok_unit: adj.unitUuid,
        };

        // Sesuai permintaan: stok_qty_min atau stok_qty_plus dengan value qty absolute
        if (diff > 0) {
            item.stok_qty_plus = diff;
        } else {
            item.stok_qty_min = Math.abs(diff);
        }
        
        return item;
    }).filter(item => item !== null);

    if (items.length === 0) return;

    // Buat Journal dengan tipe STOCK_ADJUSTMENT
    await this.createJournal('STOCK_ADJUSTMENT', { items }, userId, storeUuid, manager);
  }

  // Generic Create Journal (Updated to support external Transaction Manager)
  async createJournal(type: string, details: Record<string, any>, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        
        // 1. Buat Header Journal (Langsung Verified)
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
  
        // 2. Simpan Semua Parameter di 'details' sebagai Header (Kecuali items)
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
  
        // 3. Simpan Items (Looping array items)
        // Format Key otomatis menjadi snake_case dan ditambah index, misal: stok_product_uuid#0, stok_qty_plus#0
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
}