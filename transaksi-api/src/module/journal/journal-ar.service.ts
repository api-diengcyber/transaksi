import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateJournalUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class JournalArService {
  constructor(
    private readonly journalService: JournalService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  // 1. FUNGSI UNTUK MENCATAT PIUTANG BARU / MANUAL
  async createAr(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const code = await this.journalService.generateCode('AR', storeUuid); 
        
        // --- TAMBAHAN UNTUK FAKTUR KUSTOM ---
        // Ambil nilai custom invoice dari payload kasir/frontend
        const autoInvoiceCode = await this.journalService.generateCustomInvoiceCode('ar', storeUuid, manager);
        var customInvoiceCode = details.custom_journal_code || autoInvoiceCode;

        // Validasi: Jangan sampai No Faktur Manual yang sudah pernah ada terpakai lagi
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            const existingInvoice = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .innerJoin(JournalEntity, 'j', 'j.code = d.journalCode')
                .where('j.code LIKE :pattern', { pattern: '%AR%' })
                .andWhere('d.key = :key', { key: 'invoice_code' })
                .andWhere('d.value = :val', { val: customInvoiceCode })
                .getOne();

            if (existingInvoice) {
                customInvoiceCode = await this.journalService.generateCustomInvoiceCode('ar', storeUuid, manager);
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

        // PENGAMANAN: Buka bungkus detail jika dari frontend terkirim berlapis
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
        return { message: 'AR journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  // 2. FUNGSI UNTUK MENCATAT PELUNASAN / PEMBAYARAN PIUTANG
  async payAr(details: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const code = await this.journalService.generateCode('PAY_AR', storeUuid); 
        
        const journal = manager.create(JournalEntity, {
          uuid: generateJournalUuid(storeUuid),
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(journal);

        const detailEntities: JournalDetailEntity[] = [];

        const dataDetails = details?.details ? details.details : details;

        if (dataDetails.amount) {
            dataDetails.nominal_ar_paid = dataDetails.amount;
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
        return { message: 'AR Payment journal created', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  async getReport(storeUuid: string, queryParams?: any) {
    const { page = 1, limit = 15, search = '', startDate, endDate } = queryParams || {};

    // 1. Ambil jurnal Penjualan (SALE) dan Pembayaran Piutang (PAY_AR)
    const qb = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('(journal.code LIKE :sale OR journal.code LIKE :payar)', { sale: `%SALE%`, payar: `%PAY_AR%` });
    
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

    // 4. Filter HANYA Penjualan Kredit (Piutang)
    const mainSales = formattedJournals.filter(j => 
        j.code.includes('SALE') && 
        !j.code.includes('RET_SALE') && 
        (j.detailsMap['is_credit'] === 'true' || j.detailsMap['is_credit'] === true)
    );
    const payments = formattedJournals.filter(j => j.code.includes('PAY_AR'));
    const returns = formattedJournals.filter(j => j.code.includes('RET_SALE'));

    // 5. Proses Ekstraksi Data AR
    const allAR = mainSales.map(main => {
      let memberName = main.detailsMap['member'] || main.detailsMap['member_name'] || main.detailsMap['customer'] || main.detailsMap['pelanggan'];
      let memberUuid = main.detailsMap['member_uuid'] || main.detailsMap['customer_uuid'];
      
      if (!memberName) {
         const itemMemberKey = Object.keys(main.detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid'));
         if (itemMemberKey) memberName = main.detailsMap[itemMemberKey];
      }

      // Ekstrak Pembayaran/Cicilan Piutang
      const salePayments = payments
          .filter(p => p.detailsMap['reference_journal_code'] === main.code)
          .map(p => ({
            code: p.code,
            date: p.createdAt,
            amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ar_paid'] || 0),
            method: p.detailsMap['payment_method'] || 'CASH',
            notes: p.detailsMap['notes'] || ''
          }));

      // Ekstrak Retur (Bisa Mengurangi Piutang)
      const saleReturns = returns
          .filter(r => r.detailsMap['reference_journal_code'] === main.code)
          .map(r => ({
            code: r.code,
            date: r.createdAt,
            amount: Number(r.detailsMap['grand_total'] || r.detailsMap['amount'] || 0)
          }));

      const total = Number(main.detailsMap['grand_total'] || main.detailsMap['amount'] || 0);
      const dp = Number(main.detailsMap['amount_cash'] || 0);
      const invoiceCode = main.detailsMap['invoice_code'] || main.code;
      
      const totalPaid = dp + salePayments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = total - totalPaid;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
        date: main.createdAt,
        type: 'AR',
        total: total,
        dp: dp,
        paid: totalPaid,
        remaining: remaining > 0 ? remaining : 0, // Pastikan tidak minus jika lunas
        member: memberName || 'Pelanggan Umum',
        memberUuid: memberUuid || null,
        payments: salePayments, 
        returns: saleReturns 
      };
    });

    // 6. Pencarian Global
    let filteredAR = allAR;
    if (search) {
        const lowerSearch = search.toLowerCase();
        filteredAR = allAR.filter(s => 
            s.code.toLowerCase().includes(lowerSearch) ||
            s.invoiceCode.toLowerCase().includes(lowerSearch) ||
            s.member.toLowerCase().includes(lowerSearch)
        );
    }

    // 7. Summary Kalkulasi
    let totalPiutang = 0;
    let totalTerbayar = 0;
    let totalSisaPiutang = 0;

    filteredAR.forEach(ar => {
        totalPiutang += ar.total;
        totalTerbayar += ar.paid;
        totalSisaPiutang += ar.remaining;
    });

    const summary = { totalPiutang, totalTerbayar, totalSisaPiutang };

    // 8. Paginasi Server Side
    const totalRecords = filteredAR.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedData = filteredAR.slice(startIndex, startIndex + Number(limit));

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