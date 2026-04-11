import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';
import { JournalArService } from './journal-ar.service';

@Injectable()
export class JournalSaleService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject(forwardRef(() => JournalArService))
    private readonly journalArService: JournalArService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  // --- LOGIKA PERHITUNGAN HPP ---
  private async calculateItemHpp(manager: EntityManager, storeUuid: string, productUuid: string, qtyNeeded: number, method: string): Promise<number> {
    try {
        const buyDetailsWithProd = await manager.createQueryBuilder(JournalDetailEntity, 'd')
            .innerJoin(JournalEntity, 'j', 'j.code = d.journalCode')
            .where('j.code LIKE :buyPattern', { buyPattern: '%BUY%' })
            .andWhere('j.uuid LIKE :store', { store: `${storeUuid}%` })
            .andWhere('d.value = :productUuid', { productUuid })
            .select(['j.code AS code', 'j.createdAt AS created_at', 'd.key AS detail_key'])
            .getRawMany();

        if (!buyDetailsWithProd || buyDetailsWithProd.length === 0) return 0;
        const buyCodes = [...new Set(buyDetailsWithProd.map(b => b.code))];

        const allBuyDetails = await manager.createQueryBuilder(JournalDetailEntity, 'd')
            .where('d.journalCode IN (:...buyCodes)', { buyCodes })
            .getMany();

        let buyBatches: { qty: number, price: number, date: Date }[] = [];

        for (const code of buyCodes) {
            const details = allBuyDetails.filter(d => d.journalCode === code);
            const prodKey = details.find(d => d.value === productUuid)?.key;
            if (prodKey) {
                const idx = prodKey.split('#')[1];
                const q = details.find(d => d.key === `qty#${idx}`)?.value;
                const p = details.find(d => d.key === `price#${idx}` || d.key === `buy_price#${idx}`)?.value;
                const journalDateStr = buyDetailsWithProd.find(b => b.code === code)?.created_at;
                
                buyBatches.push({ qty: Number(q || 0), price: Number(p || 0), date: new Date(journalDateStr) });
            }
        }

        const saleDetailsWithProd = await manager.createQueryBuilder(JournalDetailEntity, 'd')
            .innerJoin(JournalEntity, 'j', 'j.code = d.journalCode')
            .where('j.code LIKE :salePattern', { salePattern: '%SALE%' })
            .andWhere('j.uuid LIKE :store', { store: `${storeUuid}%` })
            .andWhere('d.value = :productUuid', { productUuid })
            .select(['j.code AS code', 'd.key AS detail_key'])
            .getRawMany();

        let totalPastSales = 0;
        if (saleDetailsWithProd && saleDetailsWithProd.length > 0) {
            const saleCodes = [...new Set(saleDetailsWithProd.map(s => s.code))];
            const allSaleDetails = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .where('d.journalCode IN (:...saleCodes)', { saleCodes })
                .getMany();

            for (const code of saleCodes) {
                const details = allSaleDetails.filter(d => d.journalCode === code);
                const prodKey = details.find(d => d.value === productUuid)?.key;
                if (prodKey) {
                    const idx = prodKey.split('#')[1];
                    const q = details.find(d => d.key === `qty#${idx}`)?.value;
                    totalPastSales += Number(q || 0);
                }
            }
        }

        buyBatches.sort((a, b) => a.date.getTime() - b.date.getTime());

        let remainingPastSales = totalPastSales;
        let availableBatches: any[] = [];
        for (const batch of buyBatches) {
            if (remainingPastSales >= batch.qty) {
                remainingPastSales -= batch.qty;
            } else {
                availableBatches.push({ qty: batch.qty - remainingPastSales, price: batch.price, date: batch.date });
                remainingPastSales = 0;
            }
        }

        let totalHpp = 0;
        let needToFulfill = qtyNeeded;
        const methodUpper = method?.toUpperCase() || 'FIFO';

        if (methodUpper === 'AVERAGE') {
            let sumVal = 0;
            let sumQty = 0;
            for (const b of availableBatches) {
                sumVal += b.qty * b.price;
                sumQty += b.qty;
            }
            const avg = sumQty > 0 ? sumVal / sumQty : 0;
            totalHpp = avg * qtyNeeded;
        } else {
            if (methodUpper === 'LIFO') availableBatches.reverse(); 
            for (const b of availableBatches) {
                if (needToFulfill <= 0) break;
                const take = Math.min(needToFulfill, b.qty);
                totalHpp += take * b.price;
                needToFulfill -= take;
            }
        }
        return totalHpp;
    } catch (error) {
        console.error('Error calculating HPP:', error);
        return 0; 
    }
  }

  async createSale(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        
        // 1. Selalu generate 'code' bawaan sistem (Default System)
        const code = await this.journalService.generateCode('SALE', storeUuid);
        
        // 2. Ambil nilai custom invoice dari payload kasir
        const customInvoiceCode = payload.custom_journal_code;

        // 3. Validasi: Jangan sampai kasir memasukkan No Faktur Manual yang sudah pernah ada
        if (customInvoiceCode && customInvoiceCode.trim() !== '') {
            const existingInvoice = await manager.createQueryBuilder(JournalDetailEntity, 'd')
                .where('d.key = :key', { key: 'invoice_code' })
                .andWhere('d.value = :val', { val: customInvoiceCode })
                .getOne();

            if (existingInvoice) {
                throw new BadRequestException(`Nomor Faktur/Invoice "${customInvoiceCode}" sudah pernah digunakan. Silakan gunakan nomor lain.`);
            }
        }

        // 4. Simpan ke Journal Utama MENGGUNAKAN CODE SYSTEM
        const journal = manager.create(JournalEntity, {
          uuid: customJournalUuid,
          code: code, // <-- Tetap aman menggunakan SALE-...
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
                key: 'invoice_code', // <-- Disimpan sebagai key terpisah
                value: customInvoiceCode,
                journalCode: code,
                createdBy: userId,
            }));
        }

        const dataDetails = payload.details ? payload.details : payload;

        Object.entries(dataDetails).forEach(([key, value]) => {
          // Abaikan field yang tidak perlu masuk detail lagi
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
            const stockItemsToDeduct: any[] = [];
            let globalTotalHpp = 0; 

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];
                
                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                if (!finalWarehouseUuid && (item.shelve_uuid || item.stok_shelve_uuid)) {
                    const shelveData: any = await manager.getRepository('ShelveEntity').findOne({ 
                        where: { uuid: item.shelve_uuid || item.stok_shelve_uuid },
                        relations: ['warehouse'] 
                    });
                    if (shelveData && shelveData.warehouse) finalWarehouseUuid = shelveData.warehouse.uuid;
                }
                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                const productUuid = item.product_uuid || item.stok_product_uuid;
                const qtyBought = Number(item.qty || item.stok_qty_min || 1);
                const hppMethod = item.hpp_method || 'FIFO';
                const itemTotalHpp = await this.calculateItemHpp(manager, storeUuid, productUuid, qtyBought, hppMethod);
                
                globalTotalHpp += itemTotalHpp;

                stockItemsToDeduct.push({
                    productUuid: productUuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    shelveUuid: item.shelve_uuid || item.stok_shelve_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    qty: qtyBought 
                });

                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_min', 
                    'stok_shelve_uuid', 'stok_warehouse_uuid', 'stok_variant_uuid',
                    'shelve_uuid', 'warehouse_uuid'
                ];
                keysToDelete.forEach(k => delete item[k]);

                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `hpp_total#${index}`,
                    value: String(itemTotalHpp),
                    journalCode: code,
                    createdBy: userId,
                }));
                detailEntities.push(manager.create(JournalDetailEntity, {
                    uuid: generateJournalDetailUuid(storeUuid),
                    key: `hpp_unit#${index}`,
                    value: String(qtyBought > 0 ? itemTotalHpp / qtyBought : 0),
                    journalCode: code,
                    createdBy: userId,
                }));

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

            detailEntities.push(manager.create(JournalDetailEntity, {
                uuid: generateJournalDetailUuid(storeUuid),
                key: 'global_hpp_total',
                value: String(globalTotalHpp),
                journalCode: code,
                createdBy: userId,
            }));

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

        const isCredit = dataDetails.is_credit === 'true' || dataDetails.is_credit === true || dataDetails.payment_method === 'CREDIT';

        if (isCredit) {
            const amountCredit = Number(dataDetails.amount_credit) || (Number(dataDetails.grand_total) - Number(dataDetails.amount_cash || 0));

            if (amountCredit > 0) {
                const arPayload = {
                    amount: amountCredit,
                    dp_amount: Number(dataDetails.amount_cash || 0),
                    due_date: dataDetails.due_date,
                    notes: `Piutang otomatis dari Nota Penjualan: ${code} ${dataDetails.notes ? ' | ' + dataDetails.notes : ''}`,
                    customer_name: dataDetails.customer_name || 'Pelanggan Umum',
                    member_uuid: dataDetails.member_uuid || null,
                    reference_journal_code: code,
                };
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
      const invoiceCode = main.detailsMap['invoice_code'] || main.code;
      
      // Jika tunai, otomatis lunas. Jika kredit, hitung total yg sudah dibayar
      const totalPaid = isCredit ? (dp + salePayments.reduce((sum, p) => sum + p.amount, 0)) : total;

      return {
        uuid: main.uuid,
        code: main.code,
        invoiceCode: invoiceCode,
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

  async getSaleByCode(storeUuid: string, code: string) {
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

    // 3. Ambil data pelanggan
    let memberName = detailsMap['member'] || detailsMap['member_name'] || detailsMap['customer'] || detailsMap['pelanggan'];
    if (!memberName) {
       const itemMemberKey = Object.keys(detailsMap).find(k => (k.startsWith('member_name#') || k.startsWith('member#') || k.startsWith('customer#')) && !k.includes('uuid'));
       if (itemMemberKey) memberName = detailsMap[itemMemberKey];
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
               price: Number(p.sell_price || p.price || 0),
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
               price: Number(detailsMap[`sell_price#${idx}`] || detailsMap[`price#${idx}`] || 0),
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
      member: memberName || 'Pelanggan Umum',
      items: items
    };
  }
}