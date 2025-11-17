import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm'; // Import DataSource
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { ProductStockEntity } from 'src/common/entities/product_stock/product_stock.entity';
import { ProductUnitEntity, ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import { ProductPriceEntity } from 'src/common/entities/product_price/product_price.entity';
import { CreateProductDto } from './dto/product.dto';

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
  
  async create(payload: CreateProductDto) {
    const { name, userId, units } = payload;

    if (!units || units.length === 0) {
      throw new BadRequestException('Minimal harus ada 1 satuan (unit)');
    }

    return await this.dataSource.transaction(async (manager) => {
      
      // 1. Simpan Produk (Tanpa Barcode)
      const newProduct = manager.create(ProductEntity, {
        name,
        createdBy: userId,
      });
      const savedProduct = await manager.save(newProduct);

      let defaultUnitUuid: string | null = null;
      let defaultPriceUuid: string | null = null;

      for (const unitDto of units) {
        // a. Simpan Unit (Dengan Barcode)
        const newUnit = manager.create(ProductUnitEntity, {
          productUuid: savedProduct.uuid,
          unitName: unitDto.unitName,
          unitMultiplier: unitDto.unitMultiplier,
          barcode: unitDto.barcode, // <--- Simpan Barcode Disini
          createdBy: userId,
        });
        const savedUnit = await manager.save(newUnit);

        // b. Simpan Harga
        const newPrice = manager.create(ProductPriceEntity, {
          productUuid: savedProduct.uuid,
          unitUuid: savedUnit.uuid,
          price: unitDto.price,
          createdBy: userId,
        });
        const savedPrice = await manager.save(newPrice);

        // c. Simpan Stok
        const newStock = manager.create(ProductStockEntity, {
          productUuid: savedProduct.uuid,
          unitUuid: savedUnit.uuid,
          qty: unitDto.stock,
          createdBy: userId,
        });
        await manager.save(newStock);

        if (unitDto.isDefault) {
          defaultUnitUuid = savedUnit.uuid;
          defaultPriceUuid = savedPrice.uuid;
        }
      }

      if (defaultUnitUuid && defaultPriceUuid) {
        savedProduct.defaultUnitUuid = defaultUnitUuid;
        savedProduct.defaultPriceUuid = defaultPriceUuid;
        await manager.save(savedProduct);
      }

      return await manager.findOne(ProductEntity, {
        where: { uuid: savedProduct.uuid },
        relations: ['units', 'price', 'stock'],
      });
    });
  }

  async findAll() {
    return await this.productRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['units', 'stock', 'price'], 
    });
  }

  async findOne(uuid: string) {
    return await this.productRepo.findOne({
      where: { uuid },
      relations: ['units', 'stock', 'price'], 
    });
  }

  // Update: Hanya update nama
  async update(uuid: string, name: string, userId?: string) {
    const data = await this.findOne(uuid);
    if (!data) return null;
    data.name = name;
    data.updatedBy = userId;
    return await this.productRepo.save(data);
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

  async addPrice(
    productUuid: string,
    price: number,
    unitUuid: string,
    setAsDefault = false,
    userId?: string,
  ) {
    const product = await this.findOne(productUuid);
    if (!product) throw new BadRequestException('Product not found');

    if (price < 0) throw new BadRequestException('Price must be >= 0');
    let priceEntity = await this.priceRepo.findOne({
      where: {
        productUuid: productUuid,
        unitUuid: unitUuid,
      },
    });

    if (priceEntity) {
      priceEntity.price = price;
      priceEntity.updatedBy = userId;
    } else {
      const unit = await this.unitRepo.findOne({ where: { uuid: unitUuid } });
      if (!unit) throw new BadRequestException('Unit not found');
      priceEntity = this.priceRepo.create({
        productUuid,
        price,
        unitUuid,
        createdBy: userId,
      });
    }
    const savedPrice = await this.priceRepo.save(priceEntity);
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