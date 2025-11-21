import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm'; 
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { ProductStockEntity } from 'src/common/entities/product_stock/product_stock.entity';
import { ProductUnitEntity, ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import { ProductPriceEntity } from 'src/common/entities/product_price/product_price.entity';
import { ProductShelveEntity } from 'src/common/entities/product_shelve/product_shelve.entity';
import { ProductCategoryEntity } from 'src/common/entities/product_category/product_category.entity'; // Pastikan import ini ada

@Injectable()
export class ProductService {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepo: Repository<ProductEntity>,
    @Inject('PRODUCT_UNIT_REPOSITORY')
    private readonly unitRepo: Repository<ProductUnitEntity>,
    @Inject('PRODUCT_STOCK_REPOSITORY')
    private readonly stokRepo: Repository<ProductStockEntity>,
    @Inject('PRODUCT_PRICE_REPOSITORY')
    private readonly priceRepo: Repository<ProductPriceEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource, 
  ) {}
  
  // ==========================================================
  // CREATE PRODUCT (With Multi Category & Shelves)
  // ==========================================================
  async create(payload: any) {
    const { name, userId, units, prices, stocks, categoryUuids, storeUuid } = payload;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Product
      const newProduct = manager.create(ProductEntity, { 
        name, 
        createdBy: userId,
        storeUuid: storeUuid 
      });
      const savedProduct = await manager.save(newProduct);

      // [BARU] 1.1. Process Categories (Multi Category)
      if (categoryUuids && Array.isArray(categoryUuids) && categoryUuids.length > 0) {
        for (const catUuid of categoryUuids) {
            const prodCat = manager.create(ProductCategoryEntity, {
                productUuid: savedProduct.uuid,
                categoryUuid: catUuid,
                createdBy: userId
            });
            await manager.save(prodCat);
        }
      }

      let defaultUnitUuid: string | null = null;
      let defaultPriceUuid: string | null = null;
      
      // Map untuk menghubungkan tempId dari frontend ke UUID asli database
      const unitUuidMap = new Map<number, string>();

      // 2. Process Units
      for (const u of units) {
        const newUnit = manager.create(ProductUnitEntity, {
          productUuid: savedProduct.uuid,
          unitName: u.name,
          unitMultiplier: u.multiplier,
          barcode: u.barcode,
          createdBy: userId
        });
        const savedUnit = await manager.save(newUnit);
        unitUuidMap.set(u.tempId, savedUnit.uuid); 
        
        if (u.isDefault) defaultUnitUuid = savedUnit.uuid;
      }

      // 3. Process Prices
      for (const p of prices) {
        const realUnitUuid = unitUuidMap.get(p.unitTempId);
        if (realUnitUuid) {
          const newPrice = manager.create(ProductPriceEntity, {
            productUuid: savedProduct.uuid,
            unitUuid: realUnitUuid,
            name: p.name || 'Umum',
            price: p.price,
            createdBy: userId,
            isDefault: p.isDefault || false
          });
          const savedPrice = await manager.save(newPrice);
          if (p.isDefault) defaultPriceUuid = savedPrice.uuid;
        }
      }

      // 4. Process Stocks (Inventory Total) & Shelves (Lokasi Rak)
      if (stocks && stocks.length > 0) {
        for (const s of stocks) {
          const realUnitUuid = unitUuidMap.get(s.unitTempId);
          
          // A. Simpan Stok Global (Ledger)
          if (realUnitUuid && s.qty > 0) {
            const newStock = manager.create(ProductStockEntity, {
              productUuid: savedProduct.uuid,
              unitUuid: realUnitUuid,
              qty: s.qty,
              createdBy: userId
            });
            await manager.save(newStock);
          }

          // B. Simpan Alokasi Rak (Allocations)
          if (realUnitUuid && s.allocations && s.allocations.length > 0) {
             for (const alloc of s.allocations) {
                if (alloc.shelfUuid && alloc.qty > 0) {
                    const newShelfAlloc = manager.create(ProductShelveEntity, {
                        productUuid: savedProduct.uuid,
                        unitUuid: realUnitUuid,
                        shelveUuid: alloc.shelfUuid,
                        qty: alloc.qty,
                        createdBy: userId
                    });
                    await manager.save(newShelfAlloc);
                }
             }
          }
        }
      }

      // 5. Set Defaults back to Product
      if (defaultUnitUuid) savedProduct.defaultUnitUuid = defaultUnitUuid;
      if (defaultPriceUuid) savedProduct.defaultPriceUuid = defaultPriceUuid;
      await manager.save(savedProduct);

      return savedProduct;
    });
  }

  // ==========================================================
  // UPDATE PRODUCT (Fix: Category & Shelves)
  // ==========================================================
  async update(uuid: string, payload: any, userId: string, storeUuid?: string) {
    const { name, units, prices, stocks, categoryUuids } = payload;

    return await this.dataSource.transaction(async (manager) => {
        const product = await manager.findOne(ProductEntity, { where: { uuid } });
        if (!product) throw new BadRequestException('Produk tidak ditemukan');

        // 1. Update Nama
        product.name = name;
        product.updatedBy = userId;
        await manager.save(product);

        // [BARU] 1.1 Update Categories (Full Sync: Delete All -> Insert New)
        if (categoryUuids !== undefined) { // Hanya jika field dikirim
            // Hapus mapping kategori lama
            await manager.delete(ProductCategoryEntity, { productUuid: uuid });
            
            // Insert baru
            if (Array.isArray(categoryUuids) && categoryUuids.length > 0) {
                for (const catUuid of categoryUuids) {
                    const prodCat = manager.create(ProductCategoryEntity, {
                        productUuid: uuid,
                        categoryUuid: catUuid,
                        createdBy: userId // Sebaiknya updatedBy, tapi tabel join biasanya immutable, jadi recreate ok
                    });
                    await manager.save(prodCat);
                }
            }
        }

        // 2. Sinkronisasi Satuan (Units)
        const unitMap = new Map<any, string>(); 

        const existingUnits = await manager.find(ProductUnitEntity, { where: { productUuid: uuid } });
        const payloadUnitIds = units.filter(u => u.uuid).map(u => u.uuid);

        // A. Delete Units
        const unitsToDelete = existingUnits.filter(u => !payloadUnitIds.includes(u.uuid));
        if (unitsToDelete.length > 0) {
            const idsToDelete = unitsToDelete.map(u => u.uuid);
            // Hapus dependensi anak dulu
            await manager.delete(ProductPriceEntity, { unitUuid: In(idsToDelete) }); 
            await manager.delete(ProductStockEntity, { unitUuid: In(idsToDelete) });
            await manager.delete(ProductShelveEntity, { unitUuid: In(idsToDelete) });
            await manager.delete(ProductUnitEntity, { uuid: In(idsToDelete) });
        }

        // B. Upsert Units
        for (const u of units) {
            let unitUuid = u.uuid;
            
            if (unitUuid) {
                // Update Existing
                await manager.update(ProductUnitEntity, { uuid: unitUuid }, {
                    unitName: u.name,
                    unitMultiplier: u.multiplier,
                    barcode: u.barcode,
                    updatedBy: userId
                });
            } else {
                // Create New Unit
                const newUnit = manager.create(ProductUnitEntity, {
                    productUuid: uuid,
                    unitName: u.name,
                    unitMultiplier: u.multiplier,
                    barcode: u.barcode,
                    createdBy: userId
                });
                const saved = await manager.save(newUnit);
                unitUuid = saved.uuid;
            }
            
            // Mapping untuk harga & rak
            if (u.tempId) unitMap.set(u.tempId, unitUuid);
            if (u.uuid) unitMap.set(u.uuid, unitUuid);

            if (u.isDefault) product.defaultUnitUuid = unitUuid;
        }

        // 3. Sinkronisasi Harga (Prices)
        const existingPrices = await manager.find(ProductPriceEntity, { where: { productUuid: uuid } });
        const payloadPriceIds = prices.filter(p => p.uuid).map(p => p.uuid);

        // A. Delete Prices
        const pricesToDelete = existingPrices.filter(p => !payloadPriceIds.includes(p.uuid));
        if (pricesToDelete.length > 0) {
            await manager.delete(ProductPriceEntity, { uuid: In(pricesToDelete.map(p => p.uuid)) });
        }

        // B. Upsert Prices
        for (const p of prices) {
            const targetUnitUuid = unitMap.get(p.unitTempId) || unitMap.get(p.unitUuid); // Handle tempId atau uuid lama

            if (targetUnitUuid) {
                if (p.uuid) {
                    await manager.update(ProductPriceEntity, { uuid: p.uuid }, {
                        name: p.name,
                        price: p.price,
                        unitUuid: targetUnitUuid,
                        updatedBy: userId
                    });
                } else {
                    const newPrice = manager.create(ProductPriceEntity, {
                        productUuid: uuid,
                        unitUuid: targetUnitUuid,
                        name: p.name,
                        price: p.price,
                        createdBy: userId
                    });
                    await manager.save(newPrice);
                    if (p.isDefault) product.defaultPriceUuid = newPrice.uuid;
                }
            }
        }

        // [PERBAIKAN ERROR] 4. Sinkronisasi Rak (Shelves Allocation)
        // Kita update konfigurasi penempatan rak. 
        // (Catatan: Stok Qty biasanya tidak diupdate disini, tapi alokasi rak iya)
        if (stocks && stocks.length > 0) {
            for (const s of stocks) {
                // Cari Unit UUID yang valid (bisa jadi unit baru dibuat di loop atas)
                // Frontend kirim unitTempId (untuk baru) atau unitUuid (untuk lama, biasanya kita map juga)
                // Asumsi frontend konsisten mengirim key pengenal unit di `unitTempId` meskipun itu uuid lama
                const realUnitUuid = unitMap.get(s.unitTempId);

                if (realUnitUuid && s.allocations) {
                    // Strategi: Hapus semua alokasi rak lama untuk unit ini, lalu insert baru.
                    // Ini paling aman untuk menghindari kerumitan diffing.
                    await manager.delete(ProductShelveEntity, { 
                        productUuid: uuid, 
                        unitUuid: realUnitUuid 
                    });

                    // Insert alokasi baru
                    for (const alloc of s.allocations) {
                        if (alloc.shelfUuid && alloc.qty > 0) {
                            const newShelfAlloc = manager.create(ProductShelveEntity, {
                                productUuid: uuid,
                                unitUuid: realUnitUuid,
                                shelveUuid: alloc.shelfUuid,
                                qty: alloc.qty,
                                createdBy: userId // atau updatedBy logic
                            });
                            await manager.save(newShelfAlloc);
                        }
                    }
                }
            }
        }

        await manager.save(product); 
        
        return await this.findOne(uuid, storeUuid); 
    });
  }

  async findAll(storeUuid?: string) {
    return await this.productRepo.find({
      where: { storeUuid: storeUuid },
      order: { createdAt: 'DESC' },
      relations: ['units', 'stock', 'price', 'shelve', 'shelve.shelve', 'productCategory', 'productCategory.category'], 
    });
  }

  async findOne(uuid: string, storeUuid?: string) {
    return await this.productRepo.findOne({where: { 
        uuid: uuid,
        storeUuid: storeUuid
      },
      relations: ['units', 'stock', 'price', 'shelve', 'shelve.shelve', 'productCategory', 'productCategory.category'],
    });
  }
  
  // ... method helper lainnya
  async softDelete(uuid: string, userId: string, storeUuid?: string) {
    const data = await this.findOne(uuid, storeUuid);
    if (!data) return null;
    data.deletedBy = userId;
    await this.productRepo.save(data);
    return this.productRepo.softDelete(uuid);
  }

  async restore(uuid: string) {
    return this.productRepo.restore(uuid);
  }
  
  async removeUnit(unitUuid: string) {
    const unit = await this.unitRepo.findOne({ 
        where: { uuid: unitUuid },
        relations: ['product'] 
    });

    if (!unit) throw new BadRequestException('Unit not found');
    if (unit.product.defaultUnitUuid === unitUuid) {
        throw new BadRequestException('Tidak bisa menghapus Satuan Default. Ubah default terlebih dahulu.');
    }
    
    await this.priceRepo.delete({ unitUuid: unitUuid });
    await this.stokRepo.delete({ unitUuid: unitUuid });
    // Hapus data rak terkait unit ini
    await this.dataSource.getRepository(ProductShelveEntity).delete({ unitUuid: unitUuid });
    
    return await this.unitRepo.remove(unit);
  }

  async addUnit(
    productUuid: string, 
    unitName: ProductUnitEnum, 
    unitMultiplier: number, 
    barcode: string,
    setAsDefault = false, 
    userId: string,
    storeUuid?: string
  ) {
    const product = await this.findOne(productUuid, storeUuid);
    if (!product) throw new BadRequestException('Product not found');
    
    const newUnit = this.unitRepo.create({ 
        productUuid, 
        unitName, 
        unitMultiplier, 
        barcode, // <--- Simpan
        createdBy: userId 
    });
    const savedUnit = await this.unitRepo.save(newUnit);
    
    if (setAsDefault) {
      product.defaultUnitUuid = savedUnit.uuid;
      await this.productRepo.save(product);
    }
    return savedUnit;
  }

  async addPrice(
    productUuid: string, 
    price: number, 
    unitUuid: string, 
    name = 'Umum', 
    setAsDefault = false, 
    userId: string, 
    storeUuid?: string
  ) {
    const product = await this.findOne(productUuid, storeUuid);
    if (!product) throw new BadRequestException('Product not found');

    const newPrice = this.priceRepo.create({ productUuid, price, unitUuid, name, createdBy: userId });
    const savedPrice = await this.priceRepo.save(newPrice);

    if (setAsDefault) {
      product.defaultPriceUuid = savedPrice.uuid;
      await this.productRepo.save(product);
    }
    return savedPrice;
  }

  async addStock(productUuid: string, qty: number, userId?: string) {
    const stok = this.stokRepo.create({ productUuid, qty, createdBy: userId });
    return await this.stokRepo.save(stok);
  }

  async reduceStock(
    productUuid: string, 
    qty: number, 
    userId: string, 
    storeUuid?: string
  ) {
    const product = await this.findOne(productUuid, storeUuid);
    if (!product) throw new BadRequestException('Product not found');
    
    // Hitung total stok global produk
    const total = product.stock.reduce((sum, s) => sum + s.qty, 0);
    if (total < qty) throw new BadRequestException('Stok tidak mencukupi');
    
    const stok = this.stokRepo.create({ productUuid, qty: -Math.abs(qty), createdBy: userId });
    return await this.stokRepo.save(stok);
  }
  
  async processSaleStock(
    details: Record<string, any>,
    userId: string | undefined,
    manager: EntityManager,
  ) {
    const itemsMap = new Map<string, any>();

    Object.keys(details).forEach((key) => {
      // Kita gunakan delimiter '_' sesuai frontend (productUuid_0)
      if (key.includes('_')) {
        const parts = key.split('_');
        
        // Ambil bagian terakhir sebagai index (string | undefined)
        const index = parts.pop(); 
        
        // Ambil sisa bagian depan sebagai nama field
        const fieldName = parts.join('_'); 

        // --- [PERBAIKAN DI SINI] ---
        // Cek: Jika index tidak ada (undefined), hentikan proses untuk key ini
        if (!index) return; 

        // Sekarang TypeScript tahu 'index' pasti string
        if (!itemsMap.has(index)) {
          itemsMap.set(index, {});
        }
        
        const itemObj = itemsMap.get(index);

        // Pastikan itemObj ada sebelum diisi
        if (itemObj) {
            if (fieldName === 'productUuid') itemObj.productUuid = details[key];
            if (fieldName === 'unitUuid') itemObj.unitUuid = details[key];
            if (fieldName === 'qty') itemObj.qty = Number(details[key]);
        }
      }
    });

    // 2. Simpan Stok Negatif (Barang Keluar)
    for (const [_, item] of itemsMap) {
      // Pastikan productUuid ada dan qty valid
      if (item.productUuid && item.qty > 0) {
        const stockEntry = manager.create(ProductStockEntity, {
          productUuid: item.productUuid,
          unitUuid: item.unitUuid || null,
          qty: -Math.abs(item.qty), // Negatif = Keluar
          createdBy: userId,
        });

        await manager.save(stockEntry);
      }
    }
  }
}