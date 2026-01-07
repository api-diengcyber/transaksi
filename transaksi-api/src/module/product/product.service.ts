import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository, Like } from 'typeorm';
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { ProductUnitEntity, ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import { ProductPriceEntity } from 'src/common/entities/product_price/product_price.entity';
import { ProductShelvePivotEntity } from 'src/common/entities/product_shelve_pivot/product_shelve_pivot.entity';
import { ProductCategoryPivotEntity } from 'src/common/entities/product_category_pivot/product_category_pivot.entity';
import { JournalService } from '../journal/journal.service';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class ProductService {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepo: Repository<ProductEntity>,
    @Inject('PRODUCT_UNIT_REPOSITORY')
    private readonly unitRepo: Repository<ProductUnitEntity>,
    @Inject('PRODUCT_PRICE_REPOSITORY')
    private readonly priceRepo: Repository<ProductPriceEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
    private readonly journalService: JournalService,
  ) { }

  // ==========================================================
  // HELPER: Calculate Stock from Journal Details (FIXED FOR DYNAMIC KEYS)
  // ==========================================================
  private async calculateStockForUnits(
    productUnits: ProductUnitEntity[],
    manager: EntityManager,
  ): Promise<Map<string, number>> {
    if (!productUnits || productUnits.length === 0) {
      return new Map();
    }
    const unitUuids = productUnits.map(u => u.uuid);

    const rawData = await manager.getRepository(JournalDetailEntity).createQueryBuilder('qtyDetail')
      .select('unitDetail.value', 'unitUuid')
      .addSelect(
        `SUM(
                CASE 
                    WHEN qtyDetail.key LIKE 'stok_qty_plus%' THEN CAST(qtyDetail.value AS DECIMAL(10,2))
                    WHEN qtyDetail.key LIKE 'stok_qty_min%' THEN -CAST(qtyDetail.value AS DECIMAL(10,2))
                    ELSE 0
                END
            )`,
        'totalQty'
      )
      // 1. Join Self berdasarkan Journal Code yang sama
      .innerJoin(JournalDetailEntity, 'unitDetail', 'unitDetail.journalCode = qtyDetail.journalCode')
      
      // 2. Filter Key Unit harus diawali 'stok_unit' (menangani stok_unit#0, stok_unit#1, dst)
      .where("unitDetail.key LIKE 'stok_unit%'")
      
      // 3. Filter Value Unit sesuai UUID yang kita cari
      .andWhere("unitDetail.value IN (:...unitUuids)", { unitUuids })
      
      // 4. Filter Key Qty harus diawali 'stok_qty_plus' atau 'stok_qty_min'
      .andWhere("(qtyDetail.key LIKE 'stok_qty_plus%' OR qtyDetail.key LIKE 'stok_qty_min%')")
      
      // 5. [PENTING] Pastikan Index Pasangan Cocok (misal: stok_unit#0 harus ketemu stok_qty_plus#0)
      // Kita ambil angka setelah tanda '#'
      .andWhere("SUBSTRING_INDEX(qtyDetail.key, '#', -1) = SUBSTRING_INDEX(unitDetail.key, '#', -1)")
      
      .groupBy('unitDetail.value')
      .getRawMany();

    const stockMap = new Map<string, number>();
    rawData.forEach(row => {
      if (row.unitUuid) {
        stockMap.set(row.unitUuid, parseFloat(row.totalQty) || 0);
      }
    });

    return stockMap;
  }

  // ==========================================================
  // CREATE PRODUCT
  // ==========================================================
  async create(payload: any) {
    const { name, userId, units, prices, stocks, stockAdjustments, categoryUuids, storeUuid } = payload;

    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for product creation.');
    }

    const customProductUuid = `${storeUuid}-${generateLocalUuid()}`;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Product
      const newProduct = manager.create(ProductEntity, {
        uuid: customProductUuid,
        name,
        createdBy: userId,
      });
      const savedProduct = await manager.save(newProduct);

      // 2. Create Categories
      if (categoryUuids && Array.isArray(categoryUuids) && categoryUuids.length > 0) {
        for (const catUuid of categoryUuids) {
          const prodCat = manager.create(ProductCategoryPivotEntity, {
            productUuid: savedProduct.uuid,
            categoryUuid: catUuid,
            createdBy: userId
          });
          await manager.save(prodCat);
        }
      }

      let defaultUnitUuid: string | null = null;
      let defaultPriceUuid: string | null = null;
      const unitUuidMap = new Map<any, string>();

      // 3. Process Units 
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

      // 4. Process Prices 
      for (const p of prices) {
        const realUnitUuid = unitUuidMap.get(p.unitTempId);
        if (realUnitUuid) {
          const newPrice = manager.create(ProductPriceEntity, {
            productUuid: savedProduct.uuid,
            unitUuid: realUnitUuid,
            name: p.name || 'Umum',
            price: p.price,
            minWholesaleQty: p.minWholesaleQty || 0,
            createdBy: userId,
            isDefault: p.isDefault || false
          });
          const savedPrice = await manager.save(newPrice);
          if (p.isDefault) defaultPriceUuid = savedPrice.uuid;
        }
      }

      // 5. Catat Stok Awal ke Journal
      if (stockAdjustments && Array.isArray(stockAdjustments) && stockAdjustments.length > 0) {
        const mappedAdjustments = stockAdjustments.map(adj => {
          // Resolve UUID Unit
          const realUnitUuid = unitUuidMap.get(adj.unitTempId) || unitUuidMap.get(adj.unitUuid) || adj.unitUuid;
          if (!realUnitUuid) return null; // Skip jika unit tidak ditemukan
          return {
            ...adj,
            productUuid: savedProduct.uuid,
            unitUuid: realUnitUuid,
          }
        }).filter(Boolean); // Hapus yang null

        if (mappedAdjustments.length > 0) {
           // Pastikan method ini ada di JournalService Anda
           await this.journalService.processStockAdjustment(mappedAdjustments, userId, manager, storeUuid);
        }
      }

      // 6. Process Shelves
      if (stocks && stocks.length > 0) {
        for (const s of stocks) {
          const realUnitUuid = unitUuidMap.get(s.unitTempId);
          if (realUnitUuid && s.allocations && s.allocations.length > 0) {
            for (const alloc of s.allocations) {
              if (alloc.shelfUuid && alloc.qty > 0) {
                const newShelfAlloc = manager.create(ProductShelvePivotEntity, {
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

      // 7. Set Defaults
      if (defaultUnitUuid) savedProduct.defaultUnitUuid = defaultUnitUuid;
      if (defaultPriceUuid) savedProduct.defaultPriceUuid = defaultPriceUuid;
      await manager.save(savedProduct);

      return await this.findOne(savedProduct.uuid, storeUuid);
    });
  }

  // ==========================================================
  // UPDATE PRODUCT (FIXED)
  // ==========================================================
  // ==========================================================
  // UPDATE PRODUCT (FIXED)
  // ==========================================================
  async update(uuid: string, payload: any, userId: string, storeUuid: string) {
    const { name, units, prices, stocks, stockAdjustments, categoryUuids } = payload;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Load Existing Product
      const product = await this.findOne(uuid, storeUuid);
      if (!product) throw new BadRequestException('Produk tidak ditemukan');

      // [PENTING] Putuskan referensi relasi di memory
      product.productCategory = [];
      product.units = [];
      product.price = [];
      product.shelve = [];

      // 2. Update Nama Produk
      await manager.update(ProductEntity, { uuid: uuid }, {
        name: name,
        updatedBy: userId
      });

      // 3. Sinkronisasi Kategori
      if (categoryUuids !== undefined) {
        await manager.delete(ProductCategoryPivotEntity, { productUuid: uuid });
        
        if (Array.isArray(categoryUuids) && categoryUuids.length > 0) {
          for (const catUuid of categoryUuids) {
            const prodCat = manager.create(ProductCategoryPivotEntity, {
              productUuid: uuid,
              categoryUuid: catUuid,
              createdBy: userId
            });
            await manager.save(prodCat);
          }
        }
      }

      // 4. Sinkronisasi Satuan (Units)
      const unitMap = new Map<any, string>();
      const existingUnits = await manager.find(ProductUnitEntity, { where: { productUuid: uuid } });
      const payloadUnitIds = units.filter(u => u.uuid).map(u => u.uuid);

      // A. Hapus Unit yang dibuang user
      const unitsToDelete = existingUnits.filter(u => !payloadUnitIds.includes(u.uuid));
      if (unitsToDelete.length > 0) {
        const idsToDelete = unitsToDelete.map(u => u.uuid);
        await manager.delete(ProductPriceEntity, { unitUuid: In(idsToDelete) });
        await manager.delete(ProductShelvePivotEntity, { unitUuid: In(idsToDelete) });
        await manager.delete(ProductUnitEntity, { uuid: In(idsToDelete) });
      }

      let newDefaultUnitUuid = product.defaultUnitUuid;
      
      // B. Upsert Units (Simpan Unit Baru/Edit Unit Lama)
      for (const u of units) {
        let unitUuid = u.uuid;
        if (unitUuid) {
          // Update Existing
          await manager.update(ProductUnitEntity, { uuid: unitUuid }, {
            unitName: u.name, 
            unitMultiplier: Number(u.multiplier), // [FIX] Pastikan number
            barcode: u.barcode, 
            updatedBy: userId
          });
        } else {
          // Create New
          const newUnit = manager.create(ProductUnitEntity, {
            productUuid: uuid, 
            unitName: u.name, 
            unitMultiplier: Number(u.multiplier), 
            barcode: u.barcode, 
            createdBy: userId
          });
          const saved = await manager.save(newUnit);
          unitUuid = saved.uuid;
        }

        // [FIX] Mapping ID Frontend (tempId) ke Backend (UUID)
        if (u.tempId) unitMap.set(u.tempId, unitUuid);
        if (u.uuid) unitMap.set(u.uuid, unitUuid); // Mapping UUID ke UUID juga penting
        
        if (u.isDefault) newDefaultUnitUuid = unitUuid;
      }

      // 5. Sinkronisasi Harga (Prices)
      const existingPrices = await manager.find(ProductPriceEntity, { where: { productUuid: uuid } });
      const payloadPriceIds = prices.filter(p => p.uuid).map(p => p.uuid);

      const pricesToDelete = existingPrices.filter(p => !payloadPriceIds.includes(p.uuid));
      if (pricesToDelete.length > 0) {
        await manager.delete(ProductPriceEntity, { uuid: In(pricesToDelete.map(p => p.uuid)) });
      }

      let newDefaultPriceUuid = product.defaultPriceUuid;

      for (const p of prices) {
        // [FIX] Cari Unit UUID yang benar (bisa dari tempId atau uuid langsung)
        const targetUnitUuid = unitMap.get(p.unitTempId) || unitMap.get(p.unitUuid);
        
        if (targetUnitUuid) {
          if (p.uuid) {
            await manager.update(ProductPriceEntity, { uuid: p.uuid }, {
              name: p.name, 
              price: Number(p.price), 
              minWholesaleQty: Number(p.minWholesaleQty || 0), 
              unitUuid: targetUnitUuid, 
              updatedBy: userId
            });
            if (p.isDefault) newDefaultPriceUuid = p.uuid; 
          } else {
            const newPrice = manager.create(ProductPriceEntity, {
              productUuid: uuid, 
              unitUuid: targetUnitUuid, 
              name: p.name, 
              price: Number(p.price), 
              minWholesaleQty: Number(p.minWholesaleQty || 0), 
              createdBy: userId
            });
            const savedPrice = await manager.save(newPrice);
            if (p.isDefault) newDefaultPriceUuid = savedPrice.uuid;
          }
        }
      }

      // 6. Update Default di Parent Product
      await manager.update(ProductEntity, { uuid: uuid }, {
          defaultUnitUuid: newDefaultUnitUuid,
          defaultPriceUuid: newDefaultPriceUuid
      });

      // 7. [FIX] Catat Penyesuaian Stok (STOK OPNAME)
      // MASALAH SEBELUMNYA: Kode ini dikomentari (//)
      if (stockAdjustments && Array.isArray(stockAdjustments) && stockAdjustments.length > 0) {
        const mappedAdjustments = stockAdjustments.map(adj => {
          // Resolve UUID Unit
          const realUnitUuid = unitMap.get(adj.unitTempId) || unitMap.get(adj.unitUuid) || adj.unitUuid;
          
          if (!realUnitUuid) return null; // Skip jika unit tidak ditemukan

          return {
            ...adj,
            productUuid: uuid,
            unitUuid: realUnitUuid,
          }
        }).filter(Boolean); // Hapus yang null

        if (mappedAdjustments.length > 0) {
           // Pastikan method ini ada di JournalService Anda
           await this.journalService.processStockAdjustment(mappedAdjustments, userId, manager, storeUuid);
        }
      }

      // 8. [FIX] Sinkronisasi Rak (UPDATE RAK)
      if (stocks && stocks.length > 0) {
        for (const s of stocks) {
          // Resolve Unit UUID
          const realUnitUuid = unitMap.get(s.unitTempId) || unitMap.get(s.unitUuid) || s.unitUuid;
          
          if (realUnitUuid && s.allocations) {
            // Hapus alokasi rak lama untuk unit ini agar bersih
            await manager.delete(ProductShelvePivotEntity, { productUuid: uuid, unitUuid: realUnitUuid });
            
            // Buat alokasi baru
            for (const alloc of s.allocations) {
              const qty = Number(alloc.qty); // [FIX] Pastikan number
              if (alloc.shelfUuid && qty > 0) {
                const newShelfAlloc = manager.create(ProductShelvePivotEntity, {
                  productUuid: uuid, 
                  unitUuid: realUnitUuid, 
                  shelveUuid: alloc.shelfUuid, 
                  qty: qty, 
                  createdBy: userId
                });
                await manager.save(newShelfAlloc);
              }
            }
          }
        }
      }

      return await this.findOne(uuid, storeUuid);
    });
  }

  // ==========================================================
  // FIND ALL PAGE
  // ==========================================================
  async findAllPage(
    storeUuid?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    let queryBuilder = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.units', 'units')
      .leftJoinAndSelect('product.price', 'price')
      .leftJoinAndSelect('product.shelve', 'shelve')
      .leftJoinAndSelect('shelve.shelve', 'shelveEntity')
      .leftJoinAndSelect('product.productCategory', 'productCategory')
      .leftJoinAndSelect('productCategory.category', 'category')
      .where('product.deletedAt IS NULL');

    if (storeUuid) {
      queryBuilder = queryBuilder.andWhere("product.uuid LIKE :storePrefix", { storePrefix: `${storeUuid}%` });
    }

    if (search) {
      queryBuilder = queryBuilder.andWhere("product.name LIKE :searchQuery", { searchQuery: `%${search}%` });
    }

    queryBuilder = queryBuilder
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    if (products.length === 0 && total === 0) {
      return {
        data: [],
        meta: { total: 0, page: page, limit: limit, totalPage: 0 }
      };
    }

    const allUnits: ProductUnitEntity[] = [];
    products.forEach(p => { if (p.units) allUnits.push(...p.units); });

    if (allUnits.length > 0) {
      const manager = this.dataSource.manager;
      const stockMap = await this.calculateStockForUnits(allUnits, manager);

      products.forEach(product => {
        product.units = product.units.map(unit => ({
          ...unit,
          currentStock: stockMap.get(unit.uuid) || 0
        } as ProductUnitEntity & { currentStock: number; }));
      });
    }

    const totalPage = Math.ceil(total / limit);

    return {
      data: products,
      meta: { total: total, page: page, limit: limit, totalPage: totalPage }
    };
  }

  // ==========================================================
  // FIND ALL
  // ==========================================================
  async findAll(storeUuid?: string) {
    const whereCondition: { uuid?: any } = {};

    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}%`);
    }

    const products = await this.productRepo.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      relations: ['units', 'price', 'shelve', 'shelve.shelve', 'productCategory', 'productCategory.category'],
    });

    if (products.length === 0) return products;

    const allUnits: ProductUnitEntity[] = [];
    products.forEach(p => { if (p.units) allUnits.push(...p.units); });

    if (allUnits.length === 0) return products;

    const manager = this.dataSource.manager;
    const stockMap = await this.calculateStockForUnits(allUnits, manager);

    return products.map(product => {
      product.units = product.units.map(unit => ({
        ...unit,
        currentStock: stockMap.get(unit.uuid) || 0
      } as ProductUnitEntity & { currentStock: number; }));

      return product;
    });
  }

  // ==========================================================
  // FIND ONE
  // ==========================================================
  async findOne(uuid: string, storeUuid?: string) {
    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.units', 'units')
      .leftJoinAndSelect('product.price', 'price')
      .leftJoinAndSelect('product.shelve', 'shelve')
      .leftJoinAndSelect('shelve.shelve', 'shelveEntity')
      .leftJoinAndSelect('product.productCategory', 'productCategory')
      .leftJoinAndSelect('productCategory.category', 'category')
      .where('product.uuid = :uuid', { uuid });

    if (storeUuid) {
      query.andWhere('product.uuid LIKE :storePrefix', { storePrefix: `${storeUuid}%` });
    }

    const product = await query.getOne();

    if (!product) return null;

    if (product.units && product.units.length > 0) {
      const manager = this.dataSource.manager;
      const stockMap = await this.calculateStockForUnits(product.units, manager);

      product.units = product.units.map(unit => ({
        ...unit,
        currentStock: stockMap.get(unit.uuid) || 0
      } as ProductUnitEntity & { currentStock: number; }));
    }

    return product;
  }

  // ==========================================================
  // OTHER METHODS
  // ==========================================================
  async softDelete(uuid: string, userId: string, storeUuid?: string) {
    const data = await this.findOne(uuid, storeUuid);
    if (!data) return null;
    data.deletedBy = userId;
    await this.productRepo.save(data);
    return await this.productRepo.softDelete(uuid);
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
    await this.dataSource.getRepository(ProductShelvePivotEntity).delete({ unitUuid: unitUuid });

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
      barcode,
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
  
  // ==========================================================
  // BREAK UNIT (PECAH SATUAN)
  // ==========================================================
  async breakUnit(payload: any, userId: string, storeUuid: string) {
    const { productUuid, sourceUnitUuid, targetUnitUuid, qtyToBreak } = payload;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Ambil Data Produk & Unit
      const product = await this.findOne(productUuid, storeUuid);
      if (!product) throw new BadRequestException('Produk tidak ditemukan');

      const sourceUnit = product.units.find(u => u.uuid === sourceUnitUuid);
      const targetUnit = product.units.find(u => u.uuid === targetUnitUuid);

      if (!sourceUnit || !targetUnit) throw new BadRequestException('Satuan asal atau tujuan tidak ditemukan');

      // 2. Validasi Multiplier (Source harus lebih besar dari Target)
      if (sourceUnit.unitMultiplier <= targetUnit.unitMultiplier) {
        throw new BadRequestException('Satuan asal harus lebih besar dari satuan tujuan (Contoh: BOX ke PCS)');
      }

      // 3. Cek Stok Saat Ini
      // Kita perlu menghitung stok real-time dari jurnal untuk validasi
      // (Asumsi function calculateStockForUnits sudah ada di class ini seperti di file sebelumnya)
      const stockMap = await this.calculateStockForUnits(product.units, manager);
      const currentSourceQty = stockMap.get(sourceUnitUuid) || 0;
      const currentTargetQty = stockMap.get(targetUnitUuid) || 0;

      if (currentSourceQty < qtyToBreak) {
        throw new BadRequestException(`Stok ${sourceUnit.unitName} tidak cukup. Tersedia: ${currentSourceQty}`);
      }

      // 4. Hitung Konversi
      // Rumus: QtyBaru = QtyPecah * (MultiplierAsal / MultiplierTujuan)
      // Contoh: 1 BOX (12) -> PCS (1). 1 * (12/1) = 12 PCS.
      const conversionRatio = sourceUnit.unitMultiplier / targetUnit.unitMultiplier;
      const qtyResult = qtyToBreak * conversionRatio;

      // 5. Siapkan Payload untuk Journal Adjustment
      // Kita menggunakan mekanisme stock adjustment yang sudah ada agar tercatat di ledger
      const adjustments = [
        {
          productUuid: product.uuid,
          unitUuid: sourceUnitUuid,
          oldQty: currentSourceQty,
          newQty: currentSourceQty - qtyToBreak, // Kurangi stok asal
        },
        {
          productUuid: product.uuid,
          unitUuid: targetUnitUuid,
          oldQty: currentTargetQty,
          newQty: currentTargetQty + qtyResult, // Tambah stok tujuan
        }
      ];

      // 6. Eksekusi Jurnal
      // Menggunakan journalService yang sudah di-inject
      await this.journalService.processStockAdjustment(adjustments, userId, manager, storeUuid);

      return {
        message: 'Berhasil memecah satuan',
        brokenStock: qtyToBreak,
        gainedStock: qtyResult,
        sourceUnit: sourceUnit.unitName,
        targetUnit: targetUnit.unitName
      };
    });
  }
}