// transaksi-api/src/module/journal/journal.service.ts
import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, Like, Between, DataSource, In, EntityManager } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';

@Injectable()
export class JournalService {
  constructor(
    @Inject('JOURNAL_REPOSITORY')
    private journalRepository: Repository<JournalEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) { }

  async getJournalByUuid(uuid: string) {
    const journal = await this.journalRepository.findOne({
        where: { uuid },
        relations: ['details'], 
    });

    if (!journal) {
        throw new NotFoundException(`Jurnal dengan UUID ${uuid} tidak ditemukan`);
    }

    const { details, ...journalData } = journal;

    return {
        message: "Journal retrieved successfully",
        journal: journalData,
        details: details || []
    };
}

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
  
  async createManualJournal(payload: any, userId: string, storeUuid: string) {
    const { note, date, entries } = payload;

    // Validasi Balance
    const totalDebit = entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException('Total Debit dan Kredit harus seimbang (Balance)');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const journalCode = await this.generateCode('MANUAL', storeUuid);

      const journal = new JournalEntity();
      journal.uuid = crypto.randomUUID();
      journal.code = journalCode;
      journal.createdBy = userId;
      journal.createdAt = date ? new Date(date) : new Date();

      await queryRunner.manager.save(journal);

      const detailsToSave: JournalDetailEntity[] = [];

      // Simpan Catatan / Deskripsi
      detailsToSave.push(queryRunner.manager.create(JournalDetailEntity, {
        uuid: crypto.randomUUID(),
        journalCode: journal.code,
        key: 'note',
        value: note || 'Jurnal Umum Manual',
        createdBy: userId
      }));

      // Simpan rincian entri ke dalam satu JSON string agar mudah diparsing di Frontend
      detailsToSave.push(queryRunner.manager.create(JournalDetailEntity, {
        uuid: crypto.randomUUID(),
        journalCode: journal.code,
        key: 'manual_entries',
        value: JSON.stringify(entries),
        createdBy: userId
      }));

      await queryRunner.manager.save(detailsToSave);
      await queryRunner.commitTransaction();

      return { message: 'Jurnal manual berhasil dibuat', journalCode };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteJournal(uuid: string, userId: string) {
    const journal = await this.journalRepository.findOne({ where: { uuid } });
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');
    
    journal.deletedBy = userId;
    journal.deletedAt = new Date();
    await this.journalRepository.save(journal);
    
    return { message: 'Jurnal berhasil dihapus' };
  }

  async findAll(storeUuid: string, startDate?: string, endDate?: string) {
    const query = this.journalRepository.createQueryBuilder('journal')
      .leftJoinAndSelect('journal.details', 'detail')
      .where('journal.code LIKE :store', { store: `%MANUAL-${storeUuid}%` });
    if (startDate && endDate) {
      query.andWhere('journal.createdAt BETWEEN :startDate AND :endDate', { 
        startDate, 
        endDate
      });
    }
    query.orderBy('journal.createdAt', 'DESC');
    return await query.getMany();
  }

  // Tambahkan di dalam class JournalService
  async generateCustomInvoiceCode(menu: 'sale' | 'buy' | 'ap' | 'ar', storeUuid: string, manager: EntityManager): Promise<string> {
    // 1. Tentukan prefix setting berdasarkan menu
    const prefixMap = {
        sale: { type: 'invoice_number_type', pre: 'invoice_prefix', len: 'invoice_length', suf: 'invoice_suffix' },
        buy: { type: 'purchase_invoice_number_type', pre: 'purchase_invoice_prefix', len: 'purchase_invoice_length', suf: 'purchase_invoice_suffix' },
        ar: { type: 'ar_invoice_number_type', pre: 'ar_invoice_prefix', len: 'ar_invoice_length', suf: 'ar_invoice_suffix' },
        ap: { type: 'ap_invoice_number_type', pre: 'ap_invoice_prefix', len: 'ap_invoice_length', suf: 'ap_invoice_suffix' }
    };

    const keys = prefixMap[menu];

    // 2. Ambil semua setting sekaligus
    const settings = await manager.find(StoreSettingEntity, {
        where: { storeUuid, key: In([keys.type, keys.pre, keys.len, keys.suf]) }
    });

    const getSetting = (key: string, def: string) => settings.find(s => s.key === key)?.value || def;

    const type = getSetting(keys.type, 'system');
    const prefix = getSetting(keys.pre, '').toUpperCase();
    const suffix = getSetting(keys.suf, '').toUpperCase();
    const length = parseInt(getSetting(keys.len, '5'));

    // 3. Logika Generator (System dijadikan fallback terakhir)
    
    if (type === 'numeric') {
        // Ambil timestamp milidetik terakhir sesuai panjang digit
        const middlePart = Date.now().toString().slice(-length);
        return `${prefix}${middlePart}${suffix}`;
    } 
    
    if (type === 'alphanumeric') {
        // Alphanumeric Random
        let middlePart = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let i = 0; i < length; i++) {
            middlePart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${prefix}${middlePart}${suffix}`;
    }

    // Default / Fallback terakhir jika type adalah 'system', 'manual', atau tidak ditemukan.
    // Gunakan kode default (cth: AR-xxxx / INV-xxxx) dari system bawaan
    return await this.generateCode(menu.toUpperCase(), storeUuid);
  }
}