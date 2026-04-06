import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';
import { JournalArService } from './journal-ar.service'; // <-- IMPORT AR SERVICE

@Injectable()
export class JournalSaleService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject(forwardRef(() => JournalArService)) // <-- INJECT AR SERVICE (Gunakan forwardRef untuk hindari Circular Dependency)
    private readonly journalArService: JournalArService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createSale(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('SALE', storeUuid);
        
        // 1. Simpan Header Jurnal Penjualan (Bisa Tunai atau Kredit)
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code,
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(),
        });
        await manager.save(JournalEntity, journal);

        const detailEntities: JournalDetailEntity[] = [];
        const dataDetails = payload.details ? payload.details : payload;

        // 2. Insert Detail Global (Menyimpan is_credit, due_date, customer_name, dll)
        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items') return; 
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

        // 3. Ekstrak Items & Parsing Stok Keluar (Stock Out)
        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            const stockItemsToDeduct: any[] = [];

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];
                
                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                if (!finalWarehouseUuid && (item.shelve_uuid || item.stok_shelve_uuid)) {
                    const shelveId = item.shelve_uuid || item.stok_shelve_uuid;
                    const shelveData: any = await manager.getRepository('ShelveEntity').findOne({ 
                        where: { uuid: shelveId },
                        relations: ['warehouse'] 
                    });
                    if (shelveData && shelveData.warehouse) finalWarehouseUuid = shelveData.warehouse.uuid;
                }
                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                stockItemsToDeduct.push({
                    productUuid: item.product_uuid || item.stok_product_uuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    shelveUuid: item.shelve_uuid || item.stok_shelve_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    qty: Number(item.qty || item.stok_qty_min || 1) 
                });

                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_min', 
                    'stok_shelve_uuid', 'stok_warehouse_uuid', 'stok_variant_uuid',
                    'shelve_uuid', 'warehouse_uuid'
                ];
                keysToDelete.forEach(k => delete item[k]);

                Object.entries(item).forEach(([itemKey, itemValue]) => {
                    if (itemValue === null || itemValue === undefined) return;
                    
                    const dbKey = `${this.journalService.toSnakeCase(itemKey)}#${index}`;
                    const valStr = typeof itemValue === 'object' ? JSON.stringify(itemValue) : String(itemValue);
  
                    if (valStr.length > 0) {
                        detailEntities.push(manager.create(JournalDetailEntity, {
                            uuid: generateJournalDetailUuid(storeUuid),
                            key: dbKey,
                            value: valStr.length > 250 ? valStr.substring(0, 250) : valStr, 
                            journalCode: code,
                            createdBy: userId,
                        }));
                    }
                });
            }

            // 4. JALANKAN PEMOTONGAN STOK
            if (stockItemsToDeduct.length > 0) {
                await this.journalStokService.stockOut(
                    stockItemsToDeduct, 
                    userId, 
                    manager, 
                    storeUuid, 
                    `Otomatis dari Penjualan: ${code}`
                );
            }
        }

        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        // ==================================================================
        // 5. OTOMATISASI PIUTANG (AR) JIKA TRANSAKSI ADALAH KREDIT/HUTANG
        // ==================================================================
        const isCredit = dataDetails.is_credit === 'true' || dataDetails.is_credit === true || dataDetails.payment_method === 'CREDIT';

        if (isCredit) {
            // Hitung Piutang Murni (Total Belanja dikurangi Uang Muka / DP)
            const amountCredit = Number(dataDetails.amount_credit) || (Number(dataDetails.grand_total) - Number(dataDetails.amount_cash || 0));

            if (amountCredit > 0) {
                const arPayload = {
                    amount: amountCredit, // Sisa piutang bersih
                    dp_amount: Number(dataDetails.amount_cash || 0), // DP (Uang tunai yang dibayar di awal)
                    due_date: dataDetails.due_date,
                    notes: `Piutang otomatis dari Nota Penjualan: ${code} ${dataDetails.notes ? ' | ' + dataDetails.notes : ''}`,
                    customer_name: dataDetails.customer_name || 'Pelanggan Umum',
                    member_uuid: dataDetails.member_uuid || null,
                    reference_journal_code: code, // Tautkan piutang ini ke Nota SALE
                };

                // Panggil service AR di dalam transaksi (manager) yang sama agar jika gagal, SALE ikut di-rollback
                await this.journalArService.createAr(arPayload, userId, storeUuid, manager);
            }
        }

        return { message: 'SALE journal created successfully', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }
  
  async getReport(storeUuid: string) {
    // 1. Ambil semua jurnal yang berkaitan dengan Penjualan, Pembayaran Piutang, dan Returnya
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('(journal.code LIKE :sale OR journal.code LIKE :payar)', { sale: `%SALE%`, payar: `%PAY_AR%` })
      .orderBy('journal.createdAt', 'DESC')
      .getMany();

    // 2. Format details ke object map
    const formattedJournals = journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return { ...journal, detailsMap };
    });

    // 3. Pisah-pisahkan berdasarkan jenisnya
    const mainSales = formattedJournals.filter(j => j.code.includes('SALE') && !j.code.includes('RET_SALE'));
    const returns = formattedJournals.filter(j => j.code.includes('RET_SALE'));
    const payments = formattedJournals.filter(j => j.code.includes('PAY_AR'));

    // 4. Proses data Induk SALE
    return mainSales.map(main => {
      // Ekstrak Pelanggan / Member
      let memberName = main.detailsMap['member'] || main.detailsMap['member_name'] || main.detailsMap['customer'] || main.detailsMap['pelanggan'];
      let memberUuid = main.detailsMap['member_uuid'] || main.detailsMap['customer_uuid'];
      
      if (!memberName) {
         const itemMemberKey = Object.keys(main.detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid'));
         if (itemMemberKey) memberName = main.detailsMap[itemMemberKey];
      }
      if (!memberUuid) {
          const itemMemberUuidKey = Object.keys(main.detailsMap).find(k => k.startsWith('member_uuid#') || k.startsWith('customer_uuid#'));
          if (itemMemberUuidKey) memberUuid = main.detailsMap[itemMemberUuidKey];
      }

      // Ekstrak Daftar Barang (Items)
      const items: any[] = [];
      let idx = 0;
      while (main.detailsMap[`item_name#${idx}`] || main.detailsMap[`product_name#${idx}`] || main.detailsMap[`name#${idx}`]) {
          items.push({
              name: main.detailsMap[`item_name#${idx}`] || main.detailsMap[`product_name#${idx}`] || main.detailsMap[`name#${idx}`],
              qty: Number(main.detailsMap[`qty#${idx}`] || 1),
              price: Number(main.detailsMap[`sell_price#${idx}`] || main.detailsMap[`price#${idx}`] || 0),
              subtotal: Number(main.detailsMap[`subtotal#${idx}`] || 0)
          });
          idx++;
      }
      
      if (items.length === 0 && main.detailsMap['items']) {
         try {
             const parsed = JSON.parse(main.detailsMap['items']);
             parsed.forEach(p => items.push({
                 name: p.item_name || p.product_name || p.name,
                 qty: Number(p.qty || 1),
                 price: Number(p.sell_price || p.price || 0),
                 subtotal: Number(p.subtotal || (Number(p.qty || 1) * Number(p.sell_price || p.price || 0)))
             }));
         } catch(e) {}
      }

      // Ekstrak Cicilan Piutang (Jika Ada)
      const salePayments = payments
          .filter(p => p.detailsMap['reference_journal_code'] === main.code)
          .map(p => ({
            code: p.code,
            date: p.createdAt,
            amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ar_paid'] || 0),
            method: p.detailsMap['payment_method'] || 'CASH',
            notes: p.detailsMap['notes'] || ''
          }));

      // Ekstrak Retur (Jika Ada)
      const saleReturns = returns
          .filter(r => r.detailsMap['reference_journal_code'] === main.code)
          .map(r => ({
            code: r.code,
            date: r.createdAt,
            amount: Number(r.detailsMap['grand_total'] || r.detailsMap['amount'] || 0),
            notes: r.detailsMap['notes'] || ''
          }));

      const isCredit = main.detailsMap['is_credit'] === 'true' || main.detailsMap['is_credit'] === true;
      const total = Number(main.detailsMap['grand_total'] || main.detailsMap['amount'] || 0);
      const dp = Number(main.detailsMap['amount_cash'] || 0);
      
      // Jika tunai, otomatis lunas. Jika kredit, hitung total yg sudah dibayar
      const totalPaid = isCredit ? (dp + salePayments.reduce((sum, p) => sum + p.amount, 0)) : total;

      return {
        uuid: main.uuid,
        code: main.code,
        date: main.createdAt,
        type: 'SALE',
        total: total,
        dp: isCredit ? dp : total,
        paid: totalPaid,
        remaining: isCredit ? (total - totalPaid) : 0, // Sisa piutang
        paymentMethod: main.detailsMap['payment_method'] || 'CASH',
        isCredit: isCredit,
        member: memberName || 'Pelanggan Umum',
        memberUuid: memberUuid || null,
        referenceNo: main.detailsMap['reference_no'] || null,
        notes: main.detailsMap['notes'] || '',
        items: items, // Detail Barang
        payments: salePayments, // Detail Piutang
        returns: saleReturns // Detail Retur
      };
    });
  }
}