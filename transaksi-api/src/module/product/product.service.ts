import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository, Like } from 'typeorm';
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { ProductUnitEntity, ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import { ProductPriceEntity } from 'src/common/entities/product_price/product_price.entity';
import { ProductShelvePivotEntity } from 'src/common/entities/product_shelve_pivot/product_shelve_pivot.entity';
import { ProductCategoryPivotEntity } from 'src/common/entities/product_category_pivot/product_category_pivot.entity';
import { JournalService } from '../journal/journal.service';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity'; // Import untuk Query Stok

// HANYA UNTUK TUJUAN DEMO: Fungsi utilitas untuk menghasilkan pengenal lokal unik 
// (Anda dapat menggantinya dengan UUID v4 asli yang digabung)
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

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
  // [PERBAIKAN KRITIS] HELPER: Calculate Stock from Journal Details
  // ==========================================================
  private async calculateStockForUnits(
    productUnits: ProductUnitEntity[],
    manager: EntityManager,
  ): Promise<Map<string, number>> {
    if (!productUnits || productUnits.length === 0) {
      return new Map();
    }
    const unitUuids = productUnits.map(u => u.uuid);

    // Menggunakan SUBSTRING_INDEX(detail.key, '_', -1) untuk mendapatkan UUID unit terakhir
    // Ini lebih andal daripada kombinasi SUBSTR/INSTR yang kompleks pada MySQL.
    const rawData = await manager.getRepository(JournalDetailEntity).createQueryBuilder('detail')
      .select("SUBSTRING_INDEX(detail.key, '_', -1)", 'unitUuid')
      .addSelect(
        `SUM(
                CASE 
                    WHEN detail.key LIKE 'stok_plus_%' THEN CAST(detail.value AS DECIMAL(10,2))
                    WHEN detail.key LIKE 'stok_min_%' THEN -CAST(detail.value AS DECIMAL(10,2))
                    ELSE 0
                END
            )`,
        'totalQty'
      )
      // [PERBAIKAN] Filtering berdasarkan awal key dan Unit UUID yang diekstrak
      .where(`(detail.key LIKE 'stok_plus_%' OR detail.key LIKE 'stok_min_%')`)
      .andWhere(`SUBSTRING_INDEX(detail.key, '_', -1) IN (:...unitUuids)`, { unitUuids })
      .groupBy('unitUuid')
      .getRawMany();

    const stockMap = new Map<string, number>();
    rawData.forEach(row => {
      // Menggunakan parseFloat untuk memastikan hasil adalah angka
      if (row.unitUuid) {
        stockMap.set(row.unitUuid, parseFloat(row.totalQty) || 0);
      }
    });

    return stockMap;
  }

  // ==========================================================
  // CREATE PRODUCT (Stok Awal ke Journal)
  // ==========================================================
  async create(payload: any) {
    const { name, userId, units, prices, stocks, stockAdjustments, categoryUuids, storeUuid } = payload;

    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for product creation.');
    }

    // LOGIKA PENGGABUNGAN UUID STORE KE UUID PRODUK (PRIMARY KEY)
    // Asumsi format: [storeUuid]-[local_identifier]
    const customProductUuid = `${storeUuid}-${generateLocalUuid()}`;

    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Product & Categories 
      const newProduct = manager.create(ProductEntity, {
        uuid: customProductUuid, // Menggunakan customProductUuid sebagai Primary Key
        name,
        createdBy: userId,
        // storeUuid TIDAK ADA DI ENTITY
      });
      const savedProduct = await manager.save(newProduct);

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
            minWholesaleQty: p.minWholesaleQty || 0,
            createdBy: userId,
            isDefault: p.isDefault || false
          });
          await manager.save(newPrice);
          if (p.isDefault) defaultPriceUuid = newPrice.uuid;
        }
      }

      // 4. Catat Stok Awal ke Journal
      if (stockAdjustments && Array.isArray(stockAdjustments) && stockAdjustments.length > 0) {
        const mappedAdjustments = stockAdjustments.map(adj => {
          const realUnitUuid = unitUuidMap.get(adj.unitUuid) || adj.unitUuid;
          return {
            ...adj,
            productUuid: savedProduct.uuid,
            unitUuid: realUnitUuid,
            oldQty: 0
          }
        });
        await this.journalService.processStockAdjustment(mappedAdjustments, userId, manager, storeUuid);
      }

      // 5. Process Shelves
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

      // 6. Set Defaults & Return
      if (defaultUnitUuid) savedProduct.defaultUnitUuid = defaultUnitUuid;
      if (defaultPriceUuid) savedProduct.defaultPriceUuid = defaultPriceUuid;
      await manager.save(savedProduct);

      // findOne dipanggil dengan storeUuid untuk validasi/filtering
      return await this.findOne(savedProduct.uuid, storeUuid);
    });
  }

  // ==========================================================
  // UPDATE PRODUCT (Stok Penyesuaian ke Journal)
  // ==========================================================
  async update(uuid: string, payload: any, userId: string, storeUuid: string) {
    const { name, units, prices, stocks, stockAdjustments, categoryUuids } = payload;

    return await this.dataSource.transaction(async (manager) => {
      // Menggunakan findOne yang sudah difilter/validasi dengan storeUuid
      const product = await this.findOne(uuid, storeUuid);
      if (!product) throw new BadRequestException('Produk tidak ditemukan');

      // 1. Update Nama & Kategori (Logika lama)
      product.name = name;
      product.updatedBy = userId;
      await manager.save(product);

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

      // 2. Sinkronisasi Satuan (Units)
      const unitMap = new Map<any, string>();
      const existingUnits = await manager.find(ProductUnitEntity, { where: { productUuid: uuid } });
      const payloadUnitIds = units.filter(u => u.uuid).map(u => u.uuid);

      // A. Delete Units (Clean up prices and shelves)
      const unitsToDelete = existingUnits.filter(u => !payloadUnitIds.includes(u.uuid));
      if (unitsToDelete.length > 0) {
        const idsToDelete = unitsToDelete.map(u => u.uuid);
        await manager.delete(ProductPriceEntity, { unitUuid: In(idsToDelete) });
        await manager.delete(ProductShelvePivotEntity, { unitUuid: In(idsToDelete) });
        await manager.delete(ProductUnitEntity, { uuid: In(idsToDelete) });
      }

      // B. Upsert Units
      for (const u of units) {
        let unitUuid = u.uuid;
        if (unitUuid) {
          await manager.update(ProductUnitEntity, { uuid: unitUuid }, {
            unitName: u.name, unitMultiplier: u.multiplier, barcode: u.barcode, updatedBy: userId
          });
        } else {
          const newUnit = manager.create(ProductUnitEntity, {
            productUuid: uuid, unitName: u.name, unitMultiplier: u.multiplier, barcode: u.barcode, createdBy: userId
          });
          const saved = await manager.save(newUnit);
          unitUuid = saved.uuid;
        }

        if (u.tempId) unitMap.set(u.tempId, unitUuid);
        if (u.uuid) unitMap.set(u.uuid, unitUuid);
        if (u.isDefault) product.defaultUnitUuid = unitUuid;
      }

      // 3. Sinkronisasi Harga (Prices)
      const existingPrices = await manager.find(ProductPriceEntity, { where: { productUuid: uuid } });
      const payloadPriceIds = prices.filter(p => p.uuid).map(p => p.uuid);

      const pricesToDelete = existingPrices.filter(p => !payloadPriceIds.includes(p.uuid));
      if (pricesToDelete.length > 0) {
        await manager.delete(ProductPriceEntity, { uuid: In(pricesToDelete.map(p => p.uuid)) });
      }

      for (const p of prices) {
        const targetUnitUuid = unitMap.get(p.unitTempId) || unitMap.get(p.unitUuid);
        if (targetUnitUuid) {
          if (p.uuid) {
            await manager.update(ProductPriceEntity, { uuid: p.uuid }, {
              name: p.name, price: p.price, minWholesaleQty: p.minWholesaleQty || 0, unitUuid: targetUnitUuid, updatedBy: userId
            });
          } else {
            const newPrice = manager.create(ProductPriceEntity, {
              productUuid: uuid, unitUuid: targetUnitUuid, name: p.name, price: p.price, minWholesaleQty: p.minWholesaleQty || 0, createdBy: userId
            });
            await manager.save(newPrice);
            if (p.isDefault) product.defaultPriceUuid = newPrice.uuid;
          }
        }
      }

      // 4. Catat Penyesuaian Stok ke Journal
      if (stockAdjustments && Array.isArray(stockAdjustments) && stockAdjustments.length > 0) {
        const mappedAdjustments = stockAdjustments.map(adj => {
          const realUnitUuid = unitMap.get(adj.unitUuid) || adj.unitUuid;
          return {
            ...adj,
            productUuid: uuid,
            unitUuid: realUnitUuid,
          }
        });
        await this.journalService.processStockAdjustment(mappedAdjustments, userId, manager, storeUuid);
      }

      // 5. Sinkronisasi Rak (Shelves Allocation)
      if (stocks && stocks.length > 0) {
        for (const s of stocks) {
          const realUnitUuid = unitMap.get(s.unitTempId) || unitMap.get(s.unitUuid);
          if (realUnitUuid && s.allocations) {
            await manager.delete(ProductShelvePivotEntity, { productUuid: uuid, unitUuid: realUnitUuid });
            for (const alloc of s.allocations) {
              if (alloc.shelfUuid && alloc.qty > 0) {
                const newShelfAlloc = manager.create(ProductShelvePivotEntity, {
                  productUuid: uuid, unitUuid: realUnitUuid, shelveUuid: alloc.shelfUuid, qty: alloc.qty, createdBy: userId
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


  // ==========================================================
  // FIND ALL (Inject Stock Calculation)
  // ==========================================================
  async findAllPage(
    storeUuid?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {// Mengembalikan objek data dan metadata
    const skip = (page - 1) * limit;

    let queryBuilder = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.units', 'units')
      .leftJoinAndSelect('product.price', 'price')
      .leftJoinAndSelect('product.shelve', 'shelve')
      .leftJoinAndSelect('shelve.shelve', 'shelveEntity')
      .leftJoinAndSelect('product.productCategory', 'productCategory')
      .leftJoinAndSelect('productCategory.category', 'category')
      .where('product.deletedAt IS NULL'); // Asumsi menggunakan soft delete

    if (storeUuid) {
      // Filter berdasarkan prefix storeUuid pada kolom uuid produk (Primary Key)
      queryBuilder = queryBuilder.andWhere("product.uuid LIKE :storePrefix", { storePrefix: `${storeUuid}%` });
    }

    if (search) {
      // Pencarian berdasarkan nama produk (case-insensitive search)
      queryBuilder = queryBuilder.andWhere("product.name LIKE :searchQuery", { searchQuery: `%${search}%` });
    }

    // Tambahkan pengurutan dan pagination
    queryBuilder = queryBuilder
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Dapatkan data produk dan total
    const [products, total] = await queryBuilder.getManyAndCount();

    if (products.length === 0 && total === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page: page,
          limit: limit,
          totalPage: 0
        }
      };
    }

    // --- Inject Stock Calculation Logic (Logika stok tetap sama) ---
    const allUnits: ProductUnitEntity[] = [];
    products.forEach(p => {
      if (p.units) allUnits.push(...p.units);
    });

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
    // -------------------------------------

    const totalPage = Math.ceil(total / limit);

    return {
      data: products,
      meta: {
        total: total,
        page: page,
        limit: limit,
        totalPage: totalPage
      }
    };
  }

  async findAll(
    storeUuid?: string,
  ) {
    const whereCondition: { uuid?: any } = {};

    // Filtering menggunakan LIKE pada kolom uuid (Primary Key)
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
    products.forEach(p => {
      if (p.units) allUnits.push(...p.units);
    });

    if (allUnits.length === 0) return products;

    const manager = this.dataSource.manager;
    const stockMap = await this.calculateStockForUnits(allUnits, manager);

    return products.map(product => {
      product.units = product.units.map(unit => ({
        ...unit,
        // Attach the calculated stock as 'currentStock' property (non-entity property)
        currentStock: stockMap.get(unit.uuid) || 0
      } as ProductUnitEntity & { currentStock: number; }));

      return product;
    });
  }

  // ==========================================================
  // FIND ONE (FIXED WITH QUERY BUILDER)
  // ==========================================================
  async findOne(uuid: string, storeUuid?: string) {
    // 1. Gunakan QueryBuilder agar bisa menggabungkan filter ID dan Store secara aman
    const query = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.units', 'units')
      .leftJoinAndSelect('product.price', 'price')
      .leftJoinAndSelect('product.shelve', 'shelve')
      .leftJoinAndSelect('shelve.shelve', 'shelveEntity')
      .leftJoinAndSelect('product.productCategory', 'productCategory')
      .leftJoinAndSelect('productCategory.category', 'category')
      .where('product.uuid = :uuid', { uuid }); // Cari ID spesifik

    // 2. Tambahkan filter Store (Security Check)
    // Logika: "Filter uuidnya juga where store"
    if (storeUuid) {
      query.andWhere('product.uuid LIKE :storePrefix', { storePrefix: `${storeUuid}%` });
    }

    const product = await query.getOne();

    if (!product) {
      return null;
    }

    // 3. Inject Stock Calculation (Sama seperti sebelumnya)
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
  // DELETION & UNIT MANAGEMENT
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
      // PERBAIKAN: Gunakan repository untuk menyimpan entity
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
      // PERBAIKAN: Gunakan repository untuk menyimpan entity
      await this.productRepo.save(product);
    }
    return savedPrice;
  }
}