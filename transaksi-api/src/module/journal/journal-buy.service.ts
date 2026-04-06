import { Injectable, Inject, BadRequestException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalService } from './journal.service';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateJournalDetailUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';
import { JournalStokService } from './journal-stok.service';
import { JournalApService } from './journal-ap.service'; // <-- IMPORT AP SERVICE

@Injectable()
export class JournalBuyService {
  constructor(
    private readonly journalService: JournalService,
    @Inject(forwardRef(() => JournalStokService))
    private readonly journalStokService: JournalStokService, 
    @Inject(forwardRef(() => JournalApService)) // <-- INJECT AP SERVICE
    private readonly journalApService: JournalApService,
    @Inject('DATA_SOURCE') private dataSource: DataSource,
  ) {}

  async createBuy(payload: any, userId: string, storeUuid: string, externalManager?: EntityManager) {
    if (!storeUuid) throw new BadRequestException('Store ID is required.');

    const work = async (manager: EntityManager) => {
        const customJournalUuid = `${storeUuid}-JRN-${generateLocalUuid()}`;
        const code = await this.journalService.generateCode('BUY', storeUuid);
        
        // 1. Simpan Header Jurnal Pembelian (BUY)
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

        // 2. Insert Detail Parameter Global
        Object.entries(dataDetails).forEach(([key, value]) => {
          if (key === 'items') return; 
          if (value === null || value === undefined) return;
  
          let valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

          if (valStr.length > 250) {
              valStr = valStr.substring(0, 250);
          }

          detailEntities.push(manager.create(JournalDetailEntity, {
            uuid: generateJournalDetailUuid(storeUuid),
            key,
            value: valStr,
            journalCode: code,
            createdBy: userId,
          }));
        });

        // Map untuk mengkalkulasi total hutang per supplier
        const supplierTotalsMap = new Map<string, number>();

        // 3. Ekstrak Items & Parsing Stok (Stock In)
        if (dataDetails.items && Array.isArray(dataDetails.items)) {
            
            const stockItemsToAdd: any[] = [];

            for (let index = 0; index < dataDetails.items.length; index++) {
                const item = dataDetails.items[index];

                // === LOGIKA AKUMULASI HUTANG PER SUPPLIER ===
                const supplierId = item.supplier_uuid || item.stok_supplier_uuid || 'Unknown';
                const subtotal = Number(item.subtotal || (item.qty * item.buy_price) || 0);
                
                if (!supplierTotalsMap.has(supplierId)) {
                    supplierTotalsMap.set(supplierId, 0);
                }
                supplierTotalsMap.set(supplierId, (supplierTotalsMap.get(supplierId) ?? 0) + subtotal);
                // ============================================

                let finalWarehouseUuid = item.warehouse_uuid || item.stok_warehouse_uuid;
                
                if (!finalWarehouseUuid && (item.shelve_uuid || item.stok_shelve_uuid)) {
                    const shelveId = item.shelve_uuid || item.stok_shelve_uuid;
                    const shelveData: any = await manager.getRepository('ShelveEntity').findOne({ 
                        where: { uuid: shelveId },
                        relations: ['warehouse'] 
                    });
                    if (shelveData && shelveData.warehouse) {
                        finalWarehouseUuid = shelveData.warehouse.uuid;
                    }
                }

                if (!finalWarehouseUuid) {
                    const defaultWh: any = await manager.getRepository('WarehouseEntity').findOne({ where: {} });
                    finalWarehouseUuid = defaultWh ? defaultWh.uuid : storeUuid;
                }

                stockItemsToAdd.push({
                    productUuid: item.product_uuid || item.stok_product_uuid,
                    variantUuid: item.variant_uuid || item.stok_variant_uuid,
                    unitUuid: item.unit_uuid || item.stok_unit,
                    shelveUuid: item.shelve_uuid || item.stok_shelve_uuid,
                    warehouseUuid: finalWarehouseUuid,
                    supplierUuid: item.supplier_uuid || item.stok_supplier_uuid,
                    qty: Number(item.qty || item.stok_qty_plus || 1)
                });

                const keysToDelete = [
                    'stok_product_uuid', 'stok_unit', 'stok_qty_plus', 'stok_qty_min', 
                    'stok_shelve_uuid', 'stok_warehouse_uuid', 'stok_variant_uuid',
                    'shelve_uuid', 'warehouse_uuid', 'supplier_uuid'
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

            if (stockItemsToAdd.length > 0) {
                await this.journalStokService.stockIn(
                    stockItemsToAdd, 
                    userId, 
                    manager,
                    storeUuid, 
                    `Otomatis dari Pembelian/Stok Masuk: ${code}`
                );
            }
        }

        if (detailEntities.length > 0) {
            await manager.save(JournalDetailEntity, detailEntities);
        }

        // ==================================================================
        // 4. OTOMATISASI HUTANG (AP) BERDASARKAN SUPPLIER
        // ==================================================================
        const isCredit = dataDetails.is_credit === 'true' || dataDetails.is_credit === true || dataDetails.payment_method === 'CREDIT';

        if (isCredit) {
            const totalGrand = Number(dataDetails.grand_total) || 0;
            const totalDp = Number(dataDetails.amount_cash || 0);

            // Buat entri hutang (AP) untuk masing-masing supplier di keranjang belanja
            for (const [supplierId, supplierSubtotal] of supplierTotalsMap.entries()) {
                
                // DP didistribusikan secara proporsional sesuai besaran belanja ke masing-masing supplier
                const proporsionalDp = (totalGrand > 0 ? (supplierSubtotal / totalGrand) * totalDp : 0);
                const amountCreditPerSupplier = supplierSubtotal - proporsionalDp;

                if (amountCreditPerSupplier > 0) {
                    const apPayload = {
                        amount: amountCreditPerSupplier, 
                        dp_amount: proporsionalDp, 
                        due_date: dataDetails.due_date,
                        notes: `Hutang otomatis dari Pembelian: ${code} ${dataDetails.reference_no ? '(Ref: ' + dataDetails.reference_no + ')' : ''}`,
                        supplier_uuid: supplierId !== 'Unknown' ? supplierId : null,
                        reference_journal_code: code, 
                    };

                    await this.journalApService.createAp(apPayload, userId, storeUuid, manager);
                }
            }
        }

        return { message: 'BUY journal created and Stock/AP properly updated', journal, details: detailEntities };
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
      
      // Kalkulasi Lunas/Belum
      const totalPaid = isCredit ? (dp + purchasePayments.reduce((sum, p) => sum + p.amount, 0)) : total;

      return {
        uuid: main.uuid,
        code: main.code,
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
}