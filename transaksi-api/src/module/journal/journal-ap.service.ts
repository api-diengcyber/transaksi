import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalUuid, generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalApService {
  constructor(
    private readonly journalService: JournalService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createAp(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const code = await this.journalService.generateCode('AP', storeUuid); 
        
        // --- TAMBAHAN UNTUK FAKTUR KUSTOM ---
        const autoInvoiceCode = await this.journalService.generateCustomInvoiceCode('ap', storeUuid, manager);
        var customInvoiceCode = details.custom_journal_code || autoInvoiceCode;

        // Validasi Faktur Duplikat
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            const existingInvoice = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .innerJoin(JournalEntity, 'j', 'j.code = d.journalCode')
                .where('j.code LIKE :pattern', { pattern: '%AP%' })
                .andWhere('d.key = :key', { key: 'invoice_code' })
                .andWhere('d.value = :val', { val: customInvoiceCode })
                .getOne();

            if (existingInvoice) {
                customInvoiceCode = await this.journalService.generateCustomInvoiceCode('ap', storeUuid, manager);
            }
        }
        // ------------------------------------

        const journal = manager.create(JournalEntity, {
          uuid: generateJournalUuid(storeUuid),
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);

        const detailEntities: JournalDetailEntity[] = [];

        // --- SIMPAN FAKTUR KUSTOM KE DETAIL ---
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            detailEntities.push(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                key: 'invoice_code',
                value: customInvoiceCode,
                journalCode: code,
                createdBy: userId,
            }));
        }

        const dataDetails = details?.details ? details.details : details;

        Object.entries(dataDetails).forEach(([key, value]) => {
          // Abaikan field custom code agar tidak ganda
          if (key === 'custom_journal_code' || key === 'invoice_code') return;
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
        return { message: 'AP journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  // 2. FUNGSI UNTUK MENCATAT PELUNASAN / PEMBAYARAN HUTANG
  async payAp(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const code = await this.journalService.generateCode('PAY_AP', storeUuid); // Kode berawalan PAY_AP
        
        const journal = manager.create(JournalEntity, {
          uuid: generateJournalUuid(storeUuid),
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

  async getReport(storeUuid: string, queryParams?: any) {
    const { page = 1, limit = 15, search = '', startDate, endDate } = queryParams || {};

    // 1. Ambil jurnal Pembelian (BUY) dan Pembayaran Hutang (PAY_AP)
    const qb = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('(journal.code LIKE :buy OR journal.code LIKE :payap)', { buy: `%BUY%`, payap: `%PAY_AP%` });
    
    // 2. Filter Tanggal
    if (startDate && endDate) {
       qb.andWhere('journal.createdAt BETWEEN :startDate AND :endDate', { 
           startDate: `${startDate} 00:00:00`, 
           endDate: `${endDate} 23:59:59` 
       });
    }

    const journals = await qb.orderBy('journal.createdAt', 'DESC').getMany();

    // 3. Format details ke object map
    const formattedJournals = journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return { ...journal, detailsMap };
    });

    // 4. Filter HANYA Pembelian Kredit (Hutang)
    const mainBuys = formattedJournals.filter(j => 
        j.code.includes('BUY') && 
        !j.code.includes('RET_BUY') && 
        (j.detailsMap['is_credit'] === 'true' || j.detailsMap['is_credit'] === true)
    );
    const payments = formattedJournals.filter(j => j.code.includes('PAY_AP'));
    const returns = formattedJournals.filter(j => j.code.includes('RET_BUY'));

    // 5. Proses Ekstraksi Data AP
    const allAP = mainBuys.map(main => {
      let supplierName = main.detailsMap['supplier'] || main.detailsMap['supplier_name'] || main.detailsMap['vendor'];
      let supplierUuid = main.detailsMap['supplier_uuid'] || main.detailsMap['vendor_uuid'];

      // Ekstrak Pembayaran/Cicilan Hutang
      const buyPayments = payments
          .filter(p => p.detailsMap['reference_journal_code'] === main.code)
          .map(p => ({
            code: p.code,
            date: p.createdAt,
            amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ap_paid'] || 0),
            method: p.detailsMap['payment_method'] || 'CASH',
            notes: p.detailsMap['notes'] || ''
          }));

      // Ekstrak Retur (Bisa Mengurangi Hutang)
      const buyReturns = returns
          .filter(r => r.detailsMap['reference_journal_code'] === main.code)
          .map(r => ({
            code: r.code,
            date: r.createdAt,
            amount: Number(r.detailsMap['grand_total'] || r.detailsMap['amount'] || 0)
          }));

      const total = Number(main.detailsMap['grand_total'] || main.detailsMap['amount'] || 0);
      const dp = Number(main.detailsMap['amount_cash'] || 0);
      const invoiceCode = main.detailsMap['invoice_code'] || main.code;
      
      const totalPaid = dp + buyPayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = total - totalPaid;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
        date: main.createdAt,
        type: 'AP',
        total: total,
        dp: dp,
        paid: totalPaid,
        remaining: remaining > 0 ? remaining : 0, // Pastikan tidak minus jika lunas
        supplier: supplierName || 'Supplier Umum',
        supplierUuid: supplierUuid || null,
        payments: buyPayments, 
        returns: buyReturns 
      };
    });

    // 6. Pencarian Global
    let filteredAP = allAP;
    if (search) {
        const lowerSearch = search.toLowerCase();
        filteredAP = allAP.filter(s => 
            s.code.toLowerCase().includes(lowerSearch) ||
            s.invoiceCode.toLowerCase().includes(lowerSearch) ||
            s.supplier.toLowerCase().includes(lowerSearch)
        );
    }

    // 7. Summary Kalkulasi
    let totalHutang = 0;
    let totalTerbayar = 0;
    let totalSisaHutang = 0;

    filteredAP.forEach(ap => {
        totalHutang += ap.total;
        totalTerbayar += ap.paid;
        totalSisaHutang += ap.remaining;
    });

    const summary = { totalHutang, totalTerbayar, totalSisaHutang };

    // 8. Paginasi Server Side
    const totalRecords = filteredAP.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedData = filteredAP.slice(startIndex, startIndex + Number(limit));

    return {
        data: paginatedData,
        summary,
        meta: {
            total: totalRecords,
            page: Number(page),
            limit: Number(limit)
        }
    };
  }
}