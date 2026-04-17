import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

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
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('AR', storeUuid); 
        
        // --- TAMBAHAN UNTUK FAKTUR KUSTOM ---
        // Ambil nilai custom invoice dari payload kasir/frontend
        const customInvoiceCode = details.custom_journal_code || details.invoice_code;

        // Validasi: Jangan sampai No Faktur Manual yang sudah pernah ada terpakai lagi
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            const existingInvoice = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .innerJoin(JournalEntity, 'j', 'j.code = d.journalCode')
                .where('j.code LIKE :pattern', { pattern: '%AR%' })
                .andWhere('d.key = :key', { key: 'invoice_code' })
                .andWhere('d.value = :val', { val: customInvoiceCode })
                .getOne();

            if (existingInvoice) {
                throw new BadRequestException(`Nomor Faktur Piutang "${customInvoiceCode}" sudah digunakan. Silakan gunakan nomor lain.`);
            }
        }
        // ------------------------------------

        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
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
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('PAY_AR', storeUuid); 
        
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
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

  async getReport(storeUuid: string) {
    // 1. Ambil semua jurnal yang berhubungan dengan Piutang (AR & PAY_AR)
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.code LIKE :type', { type: `%AR%` }) // Menangkap 'AR' dan 'PAY_AR'
      .orderBy('journal.createdAt', 'DESC')
      .getMany();

    // 2. Mapping detail ke dalam bentuk object agar mudah diakses
    const formattedJournals = journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return { ...journal, detailsMap };
    });

    // 3. Pisahkan Jurnal Induk (AR Murni) dan Jurnal Pembayaran (PAY_AR)
    const mainAr = formattedJournals.filter(j => j.code.includes('AR') && !j.code.includes('PAY_AR'));
    const payAr = formattedJournals.filter(j => j.code.includes('PAY_AR'));

    // 4. Susun respons akhir yang sudah disarangkan (Nested)
    return mainAr.map(main => {
      // Cari semua pembayaran yang merujuk pada kode tagihan AR ini
      const payments = payAr
        .filter(p => p.detailsMap['reference_journal_code'] === main.code)
        .map(p => ({
          code: p.code,
          date: p.createdAt,
          amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ar_paid'] || 0),
          method: p.detailsMap['payment_method'] || 'CASH',
          notes: p.detailsMap['notes'] || ''
        }));

      // Kalkulasi Keuangan
      const total = Number(main.detailsMap['amount'] || main.detailsMap['grand_total'] || 0);
      const dp = Number(main.detailsMap['dp_amount'] || main.detailsMap['amount_cash'] || 0);
      const totalPaid = dp + payments.reduce((sum, p) => sum + p.amount, 0);

      // Ekstrak Informasi Pelanggan
      let memberName = main.detailsMap['member'] || main.detailsMap['member_name'] || main.detailsMap['customer'] || main.detailsMap['pelanggan'];
      let memberUuid = main.detailsMap['member_uuid'] || main.detailsMap['customer_uuid'];

      if (!memberName) {
         const itemMemberKey = Object.keys(main.detailsMap).find(k => 
           (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid')
         );
         if (itemMemberKey) memberName = main.detailsMap[itemMemberKey];
      }

      if (!memberUuid) {
          const itemMemberUuidKey = Object.keys(main.detailsMap).find(k => k.startsWith('member_uuid#') || k.startsWith('customer_uuid#'));
          if (itemMemberUuidKey) memberUuid = main.detailsMap[itemMemberUuidKey];
      }

      const invoiceCode = main.detailsMap['invoice_code'] || main.code;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
        date: main.createdAt,
        type: 'AR',
        total: total,
        dp: dp,
        paid: totalPaid,
        remaining: total - totalPaid,
        isPaidOff: (total - totalPaid) <= 0.01, // Lunas jika sisa <= 0
        member: memberName || 'Pelanggan Umum / Tidak Diketahui',
        memberUuid: memberUuid || null,
        dueDate: main.detailsMap['due_date'] || null,
        refCode: main.detailsMap['reference_journal_code'] || null, // Jurnal sumber (cth: SALE-xxx)
        referenceNo: main.detailsMap['reference_no'] || null, // Nota eksternal (cth: INV-001)
        notes: main.detailsMap['notes'] || '',
        payments: payments // <--- KUNCI: Detail cicilan langsung disarangkan di sini
      };
    });
  }
}