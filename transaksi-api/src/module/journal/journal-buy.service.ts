import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';
import { JournalApService } from './journal-ap.service'; 

@Injectable()
export class JournalBuyService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject(forwardRef(() => JournalApService)) 
    private readonly journalApService: JournalApService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createBuy(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        
        // 1. Selalu generate 'code' bawaan sistem (Default System)
        const code = await this.journalService.generateCode('BUY', storeUuid);
        
        // 2. Ambil nilai custom invoice dari payload (Nomor PO Internal)
        const customInvoiceCode = payload.custom_journal_code;

        // 3. Validasi Custom Invoice
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            const existingInvoice = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .where('d.key = :key', { key: 'invoice_code' })
                .andWhere('d.value = :val', { val: customInvoiceCode })
                .getOne();

            if (existingInvoice) {
                throw new BadRequestException(`Nomor PO / Faktur Internal "${customInvoiceCode}" sudah pernah digunakan. Silakan gunakan nomor lain.`);
            }
        }

        // 4. Simpan ke Journal Utama MENGGUNAKAN CODE SYSTEM
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code: code, // Tetap aman menggunakan BUY-...
          createdBy: userId,
          verifiedBy: userId,
          verifiedAt: new Date(), 
        });
        await manager.save(JournalEntity, journal);

        const detailEntities: JournalDetailEntity[] = [];

        // 5. Simpan CUSTOM INVOICE CODE ke tabel Journal Detail
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            detailEntities.push(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                key: 'invoice_code', 
                value: customInvoiceCode,
                journalCode: code,
                createdBy: userId,
            }));
        }

        const dataDetails = payload.details ? payload.details : payload;

        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items' || key === 'custom_journal_code') return; 
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

        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            const stockItemsToAdd: any[] = [];

            dataDetails.items.forEach((item, index) => {
                
                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                if (!finalWarehouseUuid) finalWarehouseUuid = storeUuid;

                stockItemsToAdd.push({
                    productUuid: item.product_uuid || item.stok_product_uuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    qty: item.qty || item.stok_qty_plus,
                    warehouseUuid: finalWarehouseUuid,
                    shelveUuid: null 
                });

                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_plus', 
                    'stok_warehouse_uuid', 'stok_variant_uuid', 'warehouse_uuid'
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
            });

            if (stockItemsToAdd.length > 0) {
                await this.journalStokService.stockIn(
                    stockItemsToAdd, 
                    userId, 
                    manager, 
                    storeUuid, 
                    `Otomatis dari Pembelian: ${code}`
                );
            }
        }

        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        const isCredit = dataDetails.is_credit === 'true' || dataDetails.is_credit === true || dataDetails.payment_method === 'CREDIT';

        if (isCredit) {
            const amountCredit = Number(dataDetails.amount_credit) || (Number(dataDetails.grand_total) - Number(dataDetails.amount_cash || 0));

            if (amountCredit > 0) {
                const apPayload = {
                    amount: amountCredit,
                    dp_amount: Number(dataDetails.amount_cash || 0),
                    due_date: dataDetails.due_date,
                    notes: `Hutang otomatis dari Nota Pembelian: ${code} ${dataDetails.notes ? ' | ' + dataDetails.notes : ''}`,
                    supplier_name: dataDetails.supplier || 'Supplier Umum', 
                    reference_journal_code: code,
                };
                
                await this.journalApService.createAp(apPayload, userId, storeUuid, manager);
            }
        }

        return { message: 'BUY journal created successfully', journal, details: detailEntities };
    };

    return externalManager ? await work(externalManager) : await this.dataSource.transaction(work);
  }

  async getReport(storeUuid: string) {
    // 1. Ambil semua jurnal yang berkaitan dengan Pembelian, Bayar Hutang, dan Returnya
    const journals = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('(journal.code LIKE :buy OR journal.code LIKE :payap OR journal.code LIKE :retbuy)', { 
          buy: `%BUY%`, 
          payap: `%PAY_AP%`,
          retbuy: `%RET_BUY%`
      })
      .orderBy('journal.createdAt', 'DESC')
      .getMany();

    // 2. Format details ke object map agar mudah dibaca
    const formattedJournals = journals.map(journal => {
      const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      return { ...journal, detailsMap };
    });

    // 3. Pisahkan Jurnal berdasarkan prefix
    const mainPurchases = formattedJournals.filter(j => j.code.includes('BUY') && !j.code.includes('RET_BUY'));
    const returns = formattedJournals.filter(j => j.code.includes('RET_BUY'));
    const payments = formattedJournals.filter(j => j.code.includes('PAY_AP'));

    // 4. Proses data Induk BUY
    return mainPurchases.map(main => {
      // Ekstrak Informasi Supplier
      let supplierName = main.detailsMap['supplier'] || main.detailsMap['supplier_name'] || main.detailsMap['vendor'];
      let supplierUuid = main.detailsMap['supplier_uuid'];
      
      if (!supplierName) {
         const itemSupKey = Object.keys(main.detailsMap).find(k => (k.startsWith('supplier_name#') || k.startsWith('supplier#')) && !k.includes('uuid'));
         if (itemSupKey) supplierName = main.detailsMap[itemSupKey];
      }

      // Ekstrak Daftar Barang (Items)
      const items: any[] = [];
      let idx = 0;
      while (main.detailsMap[`item_name#${idx}`] || main.detailsMap[`name#${idx}`]) {
          items.push({
              name: main.detailsMap[`item_name#${idx}`] || main.detailsMap[`name#${idx}`],
              qty: Number(main.detailsMap[`qty#${idx}`] || 1),
              price: Number(main.detailsMap[`buy_price#${idx}`] || main.detailsMap[`price#${idx}`] || 0),
              subtotal: Number(main.detailsMap[`subtotal#${idx}`] || 0)
          });
          idx++;
      }

      // Ekstrak Histori Bayar Hutang (PAY_AP)
      const purchasePayments = payments
          .filter(p => p.detailsMap['reference_journal_code'] === main.code)
          .map(p => ({
            code: p.code,
            date: p.createdAt,
            amount: Number(p.detailsMap['amount'] || p.detailsMap['nominal_ap_paid'] || 0),
            method: p.detailsMap['payment_method'] || 'CASH',
            notes: p.detailsMap['notes'] || ''
          }));

      // Ekstrak Histori Retur Beli (RET_BUY)
      const purchaseReturns = returns
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
      const invoiceCode = main.detailsMap['invoice_code'] || main.code;
      
      // Kalkulasi Lunas/Belum
      const totalPaid = isCredit ? (dp + purchasePayments.reduce((sum, p) => sum + p.amount, 0)) : total;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
        date: main.createdAt,
        type: 'BUY',
        total: total,
        dp: isCredit ? dp : total,
        paid: totalPaid,
        remaining: isCredit ? (total - totalPaid) : 0,
        isCredit: isCredit,
        supplier: supplierName || 'Supplier Umum',
        supplierUuid: supplierUuid || null,
        referenceNo: main.detailsMap['reference_no'] || null, // Nota Fisik dari Supplier
        notes: main.detailsMap['notes'] || '',
        items: items,
        payments: purchasePayments,
        returns: purchaseReturns
      };
    });
  }

  async getBuyByCode(storeUuid: string, code: string) {
    // 1. Cari jurnal beserta detailnya berdasarkan kode faktur
    const journal = await this.dataSource.manager.createQueryBuilder(JournalEntity, 'journal')
      .leftJoinAndMapMany(
        'journal.details', 
        JournalDetailEntity, 
        'detail', 
        'detail.journalCode = journal.code'
      )
      .where('journal.uuid LIKE :store', { store: `${storeUuid}%` })
      .andWhere('journal.code = :code', { code })
      .getOne();

    // Jika tidak ditemukan, kembalikan null
    if (!journal) return null;

    // 2. Mapping detail ke bentuk object key-value
    const detailsMap = (journal['details'] || []).reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    // 3. Ambil data Supplier
    let supplierName = detailsMap['supplier'] || detailsMap['supplier_name'] || detailsMap['vendor'];
    if (!supplierName) {
       const itemSupplierKey = Object.keys(detailsMap).find(k => (k.startsWith('supplier_name#') || k.startsWith('supplier#') || k.startsWith('vendor#')) && !k.includes('uuid'));
       if (itemSupplierKey) supplierName = detailsMap[itemSupplierKey];
    }

    // 4. Ekstrak dan rapikan rincian Barang (Items)
    const items: any[] = [];
    
    // Coba parsing jika items disimpan sebagai JSON String
    if (detailsMap['items']) {
       try {
           const parsed = JSON.parse(detailsMap['items']);
           parsed.forEach((p: any) => items.push({
               product_uuid: p.product_uuid || p.productUuid || null,
               variant_uuid: p.variant_uuid || p.variantUuid || null,
               unit_uuid: p.unit_uuid || p.unitUuid || null,
               warehouse_uuid: p.warehouse_uuid || p.warehouseUuid || null,
               name: p.item_name || p.product_name || p.name || 'Barang Tidak Diketahui',
               unitName: p.unit_name || p.unitName || 'Unit',
               price: Number(p.buy_price || p.price || 0), // Catatan: Mengutamakan buy_price
               qty_bought: Number(p.qty || 1),
               qty_return: 0 // Siapkan state 0 untuk frontend
           }));
       } catch(e) { console.error("Gagal parse items JSON", e); }
    } else {
       // Coba parsing jika item disimpan terpisah per-kolom (flat structure)
       let idx = 0;
       while (detailsMap[`item_name#${idx}`] || detailsMap[`product_name#${idx}`] || detailsMap[`name#${idx}`]) {
           items.push({
               product_uuid: detailsMap[`product_uuid#${idx}`] || detailsMap[`id#${idx}`] || null,
               variant_uuid: detailsMap[`variant_uuid#${idx}`] || null,
               unit_uuid: detailsMap[`unit_uuid#${idx}`] || null,
               warehouse_uuid: detailsMap[`warehouse_uuid#${idx}`] || null,
               name: detailsMap[`item_name#${idx}`] || detailsMap[`product_name#${idx}`] || detailsMap[`name#${idx}`],
               unitName: detailsMap[`unit_name#${idx}`] || 'Unit',
               price: Number(detailsMap[`buy_price#${idx}`] || detailsMap[`price#${idx}`] || 0), // Catatan: Mengutamakan buy_price
               qty_bought: Number(detailsMap[`qty#${idx}`] || 1),
               qty_return: 0 // Siapkan state 0 untuk frontend
           });
           idx++;
       }
    }

    // Kembalikan data yang sudah bersih ke Frontend
    return {
      uuid: journal.uuid,
      code: journal.code,
      date: journal.createdAt,
      supplier: supplierName || 'Supplier Umum',
      items: items
    };
  }
}