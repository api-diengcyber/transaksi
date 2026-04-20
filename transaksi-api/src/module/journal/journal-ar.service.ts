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

    // 1. Ambil jurnal Induk Piutang (AR) dan Pembayaran Piutang (PAY_AR)
    const qb = this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      // Sekarang berfokus pada kode AR dan PAY_AR
      .andWhere('(journal.code LIKE :ar OR journal.code LIKE :payar)', { ar: `%AR%`, payar: `%PAY_AR%` });
    
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

    // =====================================================================
    // 4. LOGIKA MEMBER: AMBIL NAMA DARI DATABASE JIKA ADA MEMBER_UUID
    // =====================================================================
    const uniqueMemberUuids = [...new Set(formattedJournals.map(j => j.detailsMap['member_uuid'] || j.detailsMap['customer_uuid']).filter(Boolean))];
    let dbMembersMap: Record<string, string> = {};

    if (uniqueMemberUuids.length > 0) {
        try {
            // NOTE: Sesuaikan nama tabel 'user' dengan tabel asli member Anda jika berbeda
            const membersList = await this.dataSource.query(
                `SELECT uuid, name FROM user WHERE uuid IN (?)`,
                [uniqueMemberUuids]
            );
            membersList.forEach((m: any) => {
                dbMembersMap[m.uuid] = m.name;
            });
        } catch (e) {
            console.warn('Gagal memuat nama member dari database:', e);
        }
    }
    // =====================================================================

    // Pisahkan data utama (AR) dari data cicilan (PAY_AR)
    const mainARs = formattedJournals.filter(j => j.code.includes('AR') && !j.code.includes('PAY_AR'));
    const payments = formattedJournals.filter(j => j.code.includes('PAY_AR'));

    // 5. Proses Ekstraksi Data AR
    const allAR = mainARs.map(main => {
      
      // Tentukan Nama Member yang Benar (Dari DB atau Teks)
      const memberUuid = main.detailsMap['member_uuid'] || main.detailsMap['customer_uuid'] || null;
      let memberText = main.detailsMap['member'] || main.detailsMap['member_name'] || main.detailsMap['customer'] || main.detailsMap['pelanggan'];
      
      if (!memberText) {
         const itemMemberKey = Object.keys(main.detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid'));
         if (itemMemberKey) memberText = main.detailsMap[itemMemberKey];
      }

      let finalMemberName = 'Pelanggan Umum';
      if (memberUuid && dbMembersMap[memberUuid]) {
          finalMemberName = dbMembersMap[memberUuid];
      } else if (memberText) {
          finalMemberName = memberText;
      }

      // Ekstrak Pembayaran/Cicilan Piutang
      const arPayments = payments
          .filter(p => p.detailsMap['reference_journal_code'] === main.code)
          .map(p => ({
            code: p.code,
            date: p.createdAt,
            amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ar_paid'] || 0),
            method: p.detailsMap['payment_method'] || 'CASH',
            notes: p.detailsMap['notes'] || ''
          }));

      // Menghitung Total dan Sisa
      const total = Number(main.detailsMap['grand_total'] || main.detailsMap['amount'] || main.detailsMap['nominal_ar'] || 0);
      const dp = Number(main.detailsMap['amount_cash'] || main.detailsMap['dp'] || 0);
      const invoiceCode = main.detailsMap['invoice_code'] || main.detailsMap['reference_no'] || main.code;
      const dueDate = main.detailsMap['due_date'] || main.detailsMap['dueDate'] || null;
      
      const totalPaid = dp + arPayments.reduce((sum, p) => sum + p.amount, 0);
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
        remaining: remaining > 0 ? remaining : 0, // Pastikan tidak minus
        member: finalMemberName, 
        memberUuid: memberUuid,
        payments: arPayments, 
        dueDate: dueDate, 
        // Mengosongkan returns karena Anda meminta fokus ke kode AR, biasanya retur masuk di SALE.
        // Jika AR Anda memiliki relasi RET_AR, tambahkan query terpisah seperti PAY_AR
        returns: [] 
      };
    });

    // 6. Pencarian Global (Sekarang akurat untuk member name)
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