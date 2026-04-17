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

  async getReport(storeUuid: string) {
    // 1. Ambil semua jurnal yang berhubungan dengan Hutang (AP & PAY_AP)
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.code LIKE :type', { type: `%AP%` }) // Menangkap 'AP' dan 'PAY_AP'
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

    // 3. Pisahkan Jurnal Induk (AP Murni) dan Jurnal Pembayaran (PAY_AP)
    const mainAp = formattedJournals.filter(j => j.code.includes('AP') && !j.code.includes('PAY_AP'));
    const payAp = formattedJournals.filter(j => j.code.includes('PAY_AP'));

    // 4. Susun respons akhir yang sudah disarangkan (Nested)
    return mainAp.map(main => {
      // Cari semua pembayaran yang merujuk pada kode tagihan AP ini
      const payments = payAp
        .filter(p => p.detailsMap['reference_journal_code'] === main.code)
        .map(p => ({
          code: p.code,
          date: p.createdAt,
          amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ap_paid'] || 0),
          method: p.detailsMap['payment_method'] || 'CASH',
          notes: p.detailsMap['notes'] || ''
        }));

      // Kalkulasi Keuangan
      const total = Number(main.detailsMap['amount'] || main.detailsMap['grand_total'] || 0);
      const dp = Number(main.detailsMap['dp_amount'] || main.detailsMap['amount_cash'] || 0);
      const totalPaid = dp + payments.reduce((sum, p) => sum + p.amount, 0);

      // Ekstrak Informasi Supplier
      let supplierName = main.detailsMap['supplier'] || main.detailsMap['supplier_name'] || main.detailsMap['vendor'];
      let supplierUuid = main.detailsMap['supplier_uuid'];

      if (!supplierName) {
         const itemSupplierKey = Object.keys(main.detailsMap).find(k => 
           (k.startsWith('supplier_name#') || k.startsWith('supplier#')) && !k.includes('uuid')
         );
         if (itemSupplierKey) supplierName = main.detailsMap[itemSupplierKey];
      }

      if (!supplierUuid) {
          const itemSupplierUuidKey = Object.keys(main.detailsMap).find(k => k.startsWith('supplier_uuid#'));
          if (itemSupplierUuidKey) supplierUuid = main.detailsMap[itemSupplierUuidKey];
      }
      
      const invoiceCode = main.detailsMap['invoice_code'] || main.code;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
        date: main.createdAt,
        type: 'AP',
        total: total,
        dp: dp,
        paid: totalPaid,
        remaining: total - totalPaid,
        isPaidOff: (total - totalPaid) <= 0.01, 
        supplier: supplierName || 'Supplier Umum / Tidak Diketahui',
        supplierUuid: supplierUuid || null,
        dueDate: main.detailsMap['due_date'] || null,
        refCode: main.detailsMap['reference_journal_code'] || null, // Jurnal sumber (cth: BUY-xxx)
        referenceNo: main.detailsMap['reference_no'] || null, 
        notes: main.detailsMap['notes'] || '',
        payments: payments // <--- KUNCI: Detail cicilan langsung disarangkan di sini
      };
    });
  }
}