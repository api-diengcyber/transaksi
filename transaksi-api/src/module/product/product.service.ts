import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm'; // Import DataSource
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { ProductStockEntity } from 'src/common/entities/product_stock/product_stock.entity';
import { ProductUnitEntity, ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import { ProductPriceEntity } from 'src/common/entities/product_price/product_price.entity';
import { CreateProductDto } from './dto/product.dto';
import { ProductShelveEntity } from 'src/common/entities/product_shelve/product_shelve.entity';

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
  
  async create(payload: any) {
    const { name, userId, units, prices, stocks } = payload;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Product
      const newProduct = manager.create(ProductEntity, { name, createdBy: userId });
      const savedProduct = await manager.save(newProduct);

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
          // Frontend mengirim structure: { unitTempId, qty, allocations: [{ shelfUuid, qty }] }
          if (realUnitUuid && s.allocations && s.allocations.length > 0) {
             for (const alloc of s.allocations) {
                if (alloc.shelfUuid && alloc.qty > 0) {
                  console.log('Creating shelf allocation:', {
                    productUuid: savedProduct.uuid,
                    unitUuid: realUnitUuid,
                    shelveUuid: alloc.shelfUuid,
                    qty: alloc.qty
                  });
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

  // --- FULL UPDATE (Fitur Edit Produk) ---
  async update(uuid: string, payload: any, userId: string) {
    const { name, units, prices } = payload;

    return await this.dataSource.transaction(async (manager) => {
        const product = await manager.findOne(ProductEntity, { where: { uuid } });
        if (!product) throw new BadRequestException('Produk tidak ditemukan');

        // 1. Update Nama
        product.name = name;
        product.updatedBy = userId;
        await manager.save(product);

        // 2. Sinkronisasi Satuan (Units)
        // Kita butuh Map untuk Harga nanti
        const unitMap = new Map<any, string>(); // key: uuid lama ATAU tempId baru -> value: uuid asli

        // Ambil unit yang ada di DB
        const existingUnits = await manager.find(ProductUnitEntity, { where: { productUuid: uuid } });
        const payloadUnitIds = units.filter(u => u.uuid).map(u => u.uuid);

        // A. Hapus Unit yang tidak ada di payload (Hard delete jika tidak ada stok, atau Soft delete)
        // Untuk aman, kita pakai Soft Delete atau throw error jika ada stok (disini saya pakai delete simpel)
        const unitsToDelete = existingUnits.filter(u => !payloadUnitIds.includes(u.uuid));
        if (unitsToDelete.length > 0) {
            // Cek ketergantungan dulu jika perlu, atau langsung delete
            await manager.delete(ProductPriceEntity, { unitUuid: In(unitsToDelete.map(u => u.uuid)) }); // Hapus harga terkait
            await manager.delete(ProductUnitEntity, { uuid: In(unitsToDelete.map(u => u.uuid)) });
        }

        // B. Upsert (Update or Insert) Unit
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
            
            // Simpan mapping untuk referensi harga (baik pake uuid lama atau tempId dari frontend)
            if (u.tempId) unitMap.set(u.tempId, unitUuid);
            if (u.uuid) unitMap.set(u.uuid, unitUuid);

            // Set Default
            if (u.isDefault) {
                product.defaultUnitUuid = unitUuid;
            }
        }

        // 3. Sinkronisasi Harga (Prices)
        const existingPrices = await manager.find(ProductPriceEntity, { where: { productUuid: uuid } });
        const payloadPriceIds = prices.filter(p => p.uuid).map(p => p.uuid);

        // A. Hapus Harga yang hilang
        const pricesToDelete = existingPrices.filter(p => !payloadPriceIds.includes(p.uuid));
        if (pricesToDelete.length > 0) {
            await manager.delete(ProductPriceEntity, { uuid: In(pricesToDelete.map(p => p.uuid)) });
        }

        // B. Upsert Harga
        for (const p of prices) {
            // Cari unitUuid yang benar (karena unit mungkin baru dibuat)
            // Frontend mungkin kirim unitTempId (untuk baru) atau unitUuid (untuk lama)
            const targetUnitUuid = unitMap.get(p.unitTempId) || unitMap.get(p.unitUuid);

            if (targetUnitUuid) {
                if (p.uuid) {
                    // Update
                    await manager.update(ProductPriceEntity, { uuid: p.uuid }, {
                        name: p.name,
                        price: p.price,
                        unitUuid: targetUnitUuid,
                        updatedBy: userId
                    });
                } else {
                    // Create
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

        await manager.save(product); // Save default flags
        
        return await this.findOne(uuid);
    });
  }

  async findAll() {
    return await this.productRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['units', 'stock', 'price', 'shelve', 'shelve.shelve'], // Include data rak
    });
  }

  async findOne(uuid: string) {
    return await this.productRepo.findOne({
      where: { uuid },
      relations: ['units', 'stock', 'price', 'shelve', 'shelve.shelve'],
    });
  }

  async addUnit(
      productUuid: string, 
      unitName: ProductUnitEnum, 
      unitMultiplier: number, 
      barcode: string,
      setAsDefault = false, 
      userId?: string
  ) {
    const product = await this.findOne(productUuid);
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

  async softDelete(uuid: string, userId?: string) {
    const data = await this.findOne(uuid);
    if (!data) return null;
    data.deletedBy = userId;
    await this.productRepo.save(data);
    return this.productRepo.softDelete(uuid);
  }

  async restore(uuid: string) {
    return this.productRepo.restore(uuid);
  }

  async addPrice(productUuid: string, price: number, unitUuid: string, name = 'Umum', setAsDefault = false, userId?: string) {
    const product = await this.findOne(productUuid);
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
     // Logic stok sederhana (tanpa unit specific di endpoint ini, bisa dikembangkan)
    const stok = this.stokRepo.create({ productUuid, qty, createdBy: userId });
    return await this.stokRepo.save(stok);
  }

  async reduceStock(productUuid: string, qty: number, userId?: string) {
    const product = await this.findOne(productUuid);
    if (!product) throw new BadRequestException('Product not found');
    
    // Hitung total stok global produk
    const total = product.stock.reduce((sum, s) => sum + s.qty, 0);
    if (total < qty) throw new BadRequestException('Stok tidak mencukupi');
    
    const stok = this.stokRepo.create({ productUuid, qty: -Math.abs(qty), createdBy: userId });
    return await this.stokRepo.save(stok);
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
    
    return await this.unitRepo.remove(unit);
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