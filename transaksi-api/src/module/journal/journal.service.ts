// transaksi-api/src/module/journal/journal.service.ts
import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, Like, Between, DataSource, In, EntityManager } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';
import { generateJournalConfigUuid, generateJournalDetailUuid, generateJournalTemplateUuid, generateJournalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalConfigEntity } from 'src/common/entities/journal_config/journal_config.entity';
import { JournalTemplateEntity } from 'src/common/entities/journal_template/journal_template.entity';

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

    // 1. Buat Map Chart & Pre-fill (Isi semua tanggal dari start sampai end dengan nilai 0)
    const chartMap = new Map();
    let currDate = new Date(`${startDate}T00:00:00`);
    const lastDate = new Date(`${endDate}T00:00:00`);

    // Looping berurutan untuk mengisi setiap hari
    while (currDate <= lastDate) {
      // Format ke YYYY-MM-DD dengan aman (Local Timezone)
      const year = currDate.getFullYear();
      const month = String(currDate.getMonth() + 1).padStart(2, '0');
      const day = String(currDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      chartMap.set(dateString, { 
        date: dateString, 
        sale: 0, 
        buy: 0, 
        ret_sale: 0, 
        ret_buy: 0, 
        ap: 0, 
        ar: 0 
      });

      // Tambah 1 hari
      currDate.setDate(currDate.getDate() + 1);
    }

    // 2. Timpa data 0 dengan data transaksi asli dari database
    journals.forEach((j: any) => {
      // Ambil tanggal dari createdAt database dengan aman
      const jDate = new Date(j.createdAt);
      const year = jDate.getFullYear();
      const month = String(jDate.getMonth() + 1).padStart(2, '0');
      const day = String(jDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Pastikan tanggal tersebut ada di dalam rentang Map kita
      if (chartMap.has(dateStr)) {
        const entry = chartMap.get(dateStr);
        const detailsMap = j.details.reduce((acc: any, curr: any) => { 
            acc[curr.key] = curr.value; 
            return acc; 
        }, {});
        
        // Ambil nilai nominal (grand_total atau amount)
        const value = Number(detailsMap['grand_total'] || detailsMap['amount'] || 0);

        // Filter klasifikasi kode jurnal
        if (j.code.includes('SALE') && !j.code.includes('RET')) entry.sale += value;
        else if (j.code.includes('BUY') && !j.code.includes('RET')) entry.buy += value;
        else if (j.code.includes('RET_SALE')) entry.ret_sale += value;
        else if (j.code.includes('RET_BUY')) entry.ret_buy += value;
        else if (j.code.includes('AP') && !j.code.includes('PAY')) entry.ap += value;
        else if (j.code.includes('AR') && !j.code.includes('PAY')) entry.ar += value;
      }
    });

    // 3. Ubah kembali Map ke format Array yang siap dipakai grafik
    return Array.from(chartMap.values());
  }

  async deleteJournal(uuid: string, userId: string) {
    const journal = await this.journalRepository.findOne({ where: { uuid } });
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');
    
    journal.deletedBy = userId;
    journal.deletedAt = new Date();
    await this.journalRepository.save(journal);
    
    return { message: 'Jurnal berhasil dihapus' };
  }

  async findAll(storeUuid: string, queryParams?: any) {
    const { page = 1, limit = 15, search = '', startDate, endDate, type = 'ALL' } = queryParams || {};

    const query = this.journalRepository.createQueryBuilder('journal')
      .leftJoinAndSelect('journal.details', 'detail')
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` });

    // Filter Tanggal
    if (startDate && endDate) {
      query.andWhere('journal.createdAt BETWEEN :startDate AND :endDate', { 
        startDate: `${startDate} 00:00:00`, 
        endDate: `${endDate} 23:59:59` 
      });
    }

    // Filter Pencarian (Search No Jurnal)
    if (search) {
      query.andWhere('journal.code LIKE :search', { search: `%${search}%` });
    }

    // Filter Tipe Jurnal (Manual / Sistem)
    if (type === 'MANUAL') {
      query.andWhere('(journal.code LIKE :man1 OR journal.code LIKE :man2)', { man1: 'MANUAL%', man2: 'MAN_%' });
    } else if (type === 'SYSTEM') {
      query.andWhere('(journal.code NOT LIKE :man1 AND journal.code NOT LIKE :man2)', { man1: 'MANUAL%', man2: 'MAN_%' });
    }

    query.orderBy('journal.createdAt', 'DESC');

    // Menghitung Total Data (Paginasi)
    const total = await query.getCount();
    
    if (limit > 0) {
      query.skip((Number(page) - 1) * Number(limit)).take(Number(limit));
    }

    const data = await query.getMany();

    // =========================================================================
    // INTEGRASI MAPPING CONFIG & ACCOUNT (SERVER-SIDE)
    // =========================================================================
    
    // 1. Ambil semua tipe transaksi unik dari hasil paginasi saat ini
    const transactionTypes = [...new Set(data.map(j => j.code.split('-')[0]))];
    
    let configs: any[] = [];
    if (transactionTypes.length > 0) {
      // 2. Query ke journal_config beserta relasi tabel account-nya
      configs = await this.dataSource.manager.createQueryBuilder(JournalConfigEntity, 'config')
        .leftJoinAndSelect('config.account', 'account')
        .where('config.storeUuid LIKE :storeUuid', { storeUuid: `${storeUuid}%` })
        .andWhere('config.transactionType IN (:...types)', { types: transactionTypes })
        .getMany();
    }

    // 3. Mapping data jurnal
    const mappedData = data.map(journal => {
      const transactionType = journal.code.split('-')[0];
      let ledgerEntries: any[] = [];
      let isMapped = false;

      // CEK FALLBACK: Untuk Jurnal Manual Lama yang pakai struktur JSON "manual_entries"
      const manualDetailJson = journal.details.find(d => d.key === 'manual_entries')?.value;

      if (manualDetailJson) {
        try {
          const parsed = JSON.parse(manualDetailJson);
          ledgerEntries = parsed.map((e: any) => ({
            account_code: e.accountCode,
            account_name: e.accountName,
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0
          }));
          isMapped = true;
        } catch (err) {
          console.warn('Gagal parse manual_entries JSON', err);
        }
      } 
      // LOGIKA UTAMA: Untuk Jurnal Sistem & Jurnal Manual Baru (Terkoneksi journal_config)
      else {
        const relevantConfigs = configs.filter(c => c.transactionType === transactionType);
        
        if (relevantConfigs.length > 0) {
          isMapped = true;
          journal.details.forEach(detail => {
            const val = Number(detail.value) || 0;
            if (val <= 0) return;

            const matches = relevantConfigs.filter(cfg => 
              cfg.detailKey === detail.key || (cfg.detailKey.endsWith('_') && detail.key.startsWith(cfg.detailKey))
            );

            matches.forEach(cfg => {
              ledgerEntries.push({
                account_code: cfg.account?.code || cfg.accountCode || '???',
                account_name: cfg.account?.name || 'Unknown Account',
                debit: cfg.position === 'DEBIT' ? val : 0,
                credit: cfg.position === 'CREDIT' ? val : 0,
              });
            });
          });
        }
      }

      // Grouping Saldo berdasar Kode Akun (Menggabungkan nominal jika akunnya sama dalam 1 jurnal)
      const grouped = ledgerEntries.reduce((acc, curr) => {
        const key = curr.account_code;
        if (!acc[key]) acc[key] = { ...curr, debit: 0, credit: 0 };
        else {
          acc[key].debit += curr.debit;
          acc[key].credit += curr.credit;
        }
        return acc;
      }, {});

      // Sortir debit di atas, kredit di bawah
      ledgerEntries = Object.values(grouped).sort((a: any, b: any) => b.debit - a.debit);
      
      // Kalkulasi total (hanya dari sisi debit untuk menghindari duplikasi hitungan)
      const totalAmount = ledgerEntries.reduce((sum, item: any) => sum + item.debit, 0);
      const noteEntry = journal.details.find(d => d.key === 'note');

      return {
        ...journal,
        ledgerEntries,
        // Jika isMapped false (Belum diset di config/JSON tidak valid), kembalikan null
        totalAmount: isMapped ? totalAmount : null,
        isMapped,
        note: noteEntry ? noteEntry.value : '-'
      };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit)
      }
    };
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
  
  async getTemplates(storeUuid: string) {
    // Ambil template beserta config akunnya
    const templates = await this.dataSource.query(`
      SELECT t.templateCode, t.templateName, c.detail_key AS detailKey, c.position, a.uuid AS accountUuid, a.code AS accountCode, a.name as accountName
      FROM journal_template t
      JOIN journal_config c ON c.transaction_type = t.templateCode
      JOIN account a ON a.uuid = c.account_uuid
      WHERE t.storeUuid = ?
      ORDER BY t.createdAt DESC
    `, [storeUuid]);

    // Grouping hasil query menjadi bentuk Object yang mudah dibaca frontend
    const grouped = templates.reduce((acc, curr) => {
      if (!acc[curr.templateCode]) {
        acc[curr.templateCode] = { templateCode: curr.templateCode, label: curr.templateName, entries: [] };
      }
      acc[curr.templateCode].entries.push({
        detailKey: curr.detailKey,
        uuid: curr.accountUuid,
        code: curr.accountCode,
        name: curr.accountName,
        position: curr.position
      });
      return acc;
    }, {});

    return Object.values(grouped);
  }

  // --- 2. CREATE JURNAL MANUAL ---
  async createManual(dto: CreateManualJournalDto, storeUuid: string, userUuid: string) {
    const totalDebit = dto.entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
    const totalCredit = dto.entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

    if (totalDebit !== totalCredit) throw new BadRequestException('Jurnal tidak seimbang (Unbalanced).');
    if (totalDebit <= 0) throw new BadRequestException('Nominal jurnal tidak boleh nol.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let transactionType = dto.templateCode;

      // JIKA JURNAL BARU (Tidak pakai template existing)
      if (!transactionType) {
        transactionType = `MANUAL-${storeUuid}-${Date.now()}`; // Buat prefix unik

        // A. Simpan Nama Template jika user menceklis "Save as Template"
        if (dto.saveAsTemplate && dto.templateName) {
          const tpl = new JournalTemplateEntity();
          tpl.uuid = generateJournalTemplateUuid(storeUuid);
          tpl.storeUuid = storeUuid;
          tpl.templateCode = transactionType;
          tpl.templateName = dto.templateName;
          await queryRunner.manager.save(tpl);
        }

        // B. Buat Config Jurnal (WAJIB agar masuk Laporan Keuangan)
        const configs: any[] = [];
        for (let i = 0; i < dto.entries.length; i++) {
          const entry = dto.entries[i];
          const cfg = new JournalConfigEntity();
          cfg.uuid = generateJournalConfigUuid(storeUuid);
          cfg.storeUuid = storeUuid;
          cfg.transactionType = transactionType;
          cfg.detailKey = `row_${i}`; // Auto generate key
          cfg.position = entry.debit > 0 ? 'DEBIT' : 'CREDIT';
          cfg.accountUuid = entry.accountUuid;
          configs.push(cfg);
          
          // Sisipkan detailKey ke dto agar dipakai saat save journal detail
          entry.detailKey = cfg.detailKey; 
        }
        await queryRunner.manager.save(JournalConfigEntity, configs);
      }

      // 3. Simpan Transaksi Jurnal Utama
      const dateObj = new Date(dto.date);
      const prefixCode = `${transactionType}-${dateObj.getFullYear()}${('0'+(dateObj.getMonth()+1)).slice(-2)}-`;
      
      const count = await queryRunner.manager.count(JournalEntity, { where: { code: Like(`${prefixCode}%`), uuid: Like(`${storeUuid}%`) } });
      const journalCode = `${prefixCode}${(count + 1).toString().padStart(4, '0')}`;

      const journal = new JournalEntity();
      journal.uuid = generateJournalUuid(storeUuid);
      journal.code = journalCode;
      journal.createdAt = dateObj;
      journal.createdBy = userUuid;
      await queryRunner.manager.save(journal);

      // 4. Simpan Journal Detail
      const details: any[] = [];
      
      if (dto.note) {
        const dNote = new JournalDetailEntity();
        dNote.uuid = generateJournalDetailUuid(storeUuid);
        dNote.journalCode = journalCode;
        dNote.key = 'note';
        dNote.value = dto.note;
        details.push(dNote);
      }

      for (const entry of dto.entries) {
        const amount = entry.debit > 0 ? entry.debit : entry.credit;
        if (amount > 0 && entry.detailKey) {
          const dVal = new JournalDetailEntity();
          dVal.uuid = generateJournalDetailUuid(storeUuid);
          dVal.journalCode = journalCode;
          dVal.key = entry.detailKey;
          dVal.value = amount.toString();
          details.push(dVal);
        }
      }

      await queryRunner.manager.save(JournalDetailEntity, details);
      await queryRunner.commitTransaction();

      return { message: 'Jurnal berhasil dicatat', code: journalCode };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}