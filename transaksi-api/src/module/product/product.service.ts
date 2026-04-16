import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ILike, Repository, DataSource, Like, EntityManager } from 'typeorm';
import { ProductEntity } from '../../common/entities/product/product.entity';
import { ProductVariantEntity } from '../../common/entities/product_variant/product_variant.entity';
import { ProductPriceEntity } from '../../common/entities/product_price/product_price.entity'; 
import { JournalDetailEntity } from '../../common/entities/journal_detail/journal_detail.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { generateProductUuid, generateVariantUuid, generatePriceUuid } from '../../common/utils/generate_uuid_util'; 
import { ShelveEntity } from 'src/common/entities/shelve/shelve.entity';
import { JournalStokService } from '../journal/journal-stok.service'; 

@Injectable()
export class ProductService {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepo: Repository<ProductEntity>,
    @Inject('PRODUCT_VARIANT_REPOSITORY')
    private readonly productVariantRepo: Repository<ProductVariantEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
    private readonly journalStokService: JournalStokService, 
  ) {}

  // --- FUNGSI CREATE, UPDATE, DELETE ---
  async create(dto: CreateProductDto, storeUuid: string, userId: string, externalManager?: EntityManager) {
    
    // Pindahkan inti/logic dari fungsi create ke dalam fungsi helper
    // agar bisa dieksekusi dengan manager manapun (eksternal maupun internal)
    const executeLogic = async (manager: EntityManager) => {
      const productUuid = generateProductUuid(storeUuid);
      const mappedPrices = dto.prices?.map((p) => ({
        uuid: generatePriceUuid(storeUuid), priceGroupUuid: p.priceGroupUuid, name: p.name, price: p.price || 0, minQty: p.minQty ?? 1, createdBy: userId,
      })) || [];
      const mappedVariants = dto.variants?.map((v) => ({
        uuid: generateVariantUuid(storeUuid), name: v.name, barcode: v.barcode, createdBy: userId,
        prices: v.prices?.map((vp) => ({
          uuid: generatePriceUuid(storeUuid), priceGroupUuid: vp.priceGroupUuid, name: vp.name, price: vp.price || 0, minQty: vp.minQty ?? 1, createdBy: userId,
        })) || [],
      })) || [];
      const mappedShelves = dto.shelveUuids?.map(uuid => ({ uuid } as ShelveEntity)) || [];

      const newProduct = manager.create(ProductEntity, {
        uuid: productUuid, 
        name: dto.name, 
        productCode: dto.productCode,
        barcode: dto.barcode, 
        unitUuid: dto.unitUuid, 
        categoryUuid: dto.categoryUuid,
        brandUuid: dto.brandUuid, 
        isManageStock: dto.isManageStock !== false, 
        conversionQty: dto.conversionQty || 1, 
        images: dto.images || [], 
        variants: mappedVariants, 
        prices: mappedPrices, 
        shelves: mappedShelves, 
        storeUuid: storeUuid, // Pastikan ini juga ter-set jika tidak default di DTO
        createdBy: userId,
      });

      const savedProduct = await manager.save(ProductEntity, newProduct);
      
      const inItems: any[] = [];
      const initialStock = dto.stock || 0;
      
      // 1. Ambil rak pertama sebagai tempat stok awal mendarat
      const defaultShelveUuid = dto.shelveUuids && dto.shelveUuids.length > 0 ? dto.shelveUuids[0] : null;
      let defaultWarehouseUuid: any = null;

      // 2. Cari tau rak ini ada di gudang mana
      if (defaultShelveUuid) {
          const shelve = await manager.findOne(ShelveEntity, {
              where: { uuid: defaultShelveUuid },
              relations: ['warehouse'] 
          });
          
          if (shelve && shelve.warehouse) {
              defaultWarehouseUuid = shelve.warehouse.uuid;
          } else if (shelve && (shelve as any).warehouseUuid) {
              defaultWarehouseUuid = (shelve as any).warehouseUuid; 
          }
      }
      
      // 3. Masukkan datanya ke Jurnal (HANYA JIKA PRODUK INI DIKELOLA STOKNYA)
      if (dto.isManageStock !== false) {
          // Jika produk utama punya stok, masukkan
          // if (initialStock > 0 && (!dto.variants || dto.variants.length === 0)) {
          if (!dto.variants || dto.variants.length === 0) {
            inItems.push({ 
                productUuid: productUuid, 
                unitUuid: dto.unitUuid, 
                qty: initialStock,
                shelveUuid: defaultShelveUuid,
                warehouseUuid: defaultWarehouseUuid 
            });
          }

          // Jika ada varian, masukkan stok masing-masing varian
          if (dto.variants && dto.variants.length > 0) {
            dto.variants.forEach((v, index) => {
              const vStock = v.stock || 0; 
              // if (vStock > 0) {
                inItems.push({ 
                    productUuid: productUuid, 
                    variantUuid: mappedVariants[index].uuid, 
                    unitUuid: dto.unitUuid, 
                    qty: vStock,
                    shelveUuid: defaultShelveUuid,
                    warehouseUuid: defaultWarehouseUuid
                });
              // }
            });
          }

          // Catat ke Jurnal Stok jika ada stok awal yang > 0
          if (inItems.length > 0) {
            // Kita juga lempar `manager` ini ke dalam journalStokService agar jurnal dibuat di transaksi yang sama!
            await this.journalStokService.stockIn(inItems, userId, manager, storeUuid, "Stok awal produk baru");
          }
      }

      return savedProduct;
    };

    // EKSEKUSI: Jika dikirim externalManager, langsung pakai itu. Jika tidak, buat transaksi baru.
    if (externalManager) {
        return await executeLogic(externalManager);
    } else {
        return await this.dataSource.transaction(async (manager) => {
            return await executeLogic(manager);
        });
    }
  }

  async update(uuid: string, dto: UpdateProductDto, storeUuid: string, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, { where: { uuid }, relations: ['variants', 'prices', 'variants.prices', 'shelves', 'brand'] });
      if (!product) throw new NotFoundException('Produk tidak ditemukan');

      product.name = dto.name ?? product.name;
      product.productCode = dto.productCode ?? product.productCode;
      product.barcode = dto.barcode ?? product.barcode;
      product.unitUuid = dto.unitUuid ?? product.unitUuid;
      product.categoryUuid = dto.categoryUuid ?? product.categoryUuid;
      
      product.brandUuid = dto.brandUuid ?? product.brandUuid; 
      product.isManageStock = dto.isManageStock ?? product.isManageStock; 
      product.conversionQty = dto.conversionQty ?? product.conversionQty;
      
      // [BARU] Update properti images
      product.images = dto.images ?? product.images; // <-- [BARU] Perbarui array gambar

      product.updatedBy = userId;

      if (dto.prices) {
        product.prices = dto.prices.map((p) => ({
          uuid: p.uuid || generatePriceUuid(storeUuid), priceGroupUuid: p.priceGroupUuid, name: p.name, price: p.price || 0,
          minQty: p.minQty ?? 1, updatedBy: p.uuid ? userId : null, createdBy: p.uuid ? undefined : userId,
        } as ProductPriceEntity));
      } else if (dto.prices === null) product.prices = [];

      const inItems: any[] = []; 
      
      const currentShelveUuids = dto.shelveUuids || product.shelves.map(s => s.uuid);
      const defaultShelveUuid = currentShelveUuids.length > 0 ? currentShelveUuids[0] : null;
      let defaultWarehouseUuid: any = null;

      if (defaultShelveUuid) {
          const shelve = await manager.findOne(ShelveEntity, {
              where: { uuid: defaultShelveUuid },
              relations: ['warehouse'] 
          });
          if (shelve && shelve.warehouse) {
              defaultWarehouseUuid = shelve.warehouse.uuid;
          } else if (shelve && (shelve as any).warehouseUuid) {
              defaultWarehouseUuid = (shelve as any).warehouseUuid;
          }
      }

      if (dto.variants) {
        product.variants = dto.variants.map((v) => {
          const isNewVariant = !v.uuid;
          const variantUuid = v.uuid || generateVariantUuid(storeUuid);
          
          // 3. Masukkan datanya jika ada varian baru (DAN produk dikelola stoknya)
          if (isNewVariant && (v.stock || 0) > 0 && product.isManageStock) {
             inItems.push({ 
                 productUuid: uuid, 
                 variantUuid: variantUuid, 
                 unitUuid: dto.unitUuid || product.unitUuid, 
                 qty: v.stock || 0,
                 shelveUuid: defaultShelveUuid,
                 warehouseUuid: defaultWarehouseUuid 
             });
          }

          return {
            uuid: variantUuid, name: v.name, barcode: v.barcode, updatedBy: v.uuid ? userId : null, createdBy: v.uuid ? undefined : userId,
            prices: v.prices?.map((vp) => ({
              uuid: vp.uuid || generatePriceUuid(storeUuid), priceGroupUuid: vp.priceGroupUuid, name: vp.name, price: vp.price || 0,
              minQty: vp.minQty ?? 1, updatedBy: vp.uuid ? userId : null, createdBy: vp.uuid ? undefined : userId,
            } as ProductPriceEntity)) || [],
          } as ProductVariantEntity;
        });
      } else if (dto.variants === null) product.variants = []; 

      if (dto.shelveUuids) {
        product.shelves = dto.shelveUuids.map(id => ({ uuid: id } as ShelveEntity));
      } else if (dto.shelveUuids === null) product.shelves = [];

      const savedProduct = await manager.save(ProductEntity, product);

      if (inItems.length > 0) {
        await this.journalStokService.stockIn(inItems, userId, manager, storeUuid, "Stok awal varian baru");
      }
      return savedProduct;
    });
  }

  async remove(uuid: string, userId?: string) {
    return await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, { where: { uuid }, relations: ['variants', 'prices', 'variants.prices'] });
      if (!product) throw new NotFoundException('Produk tidak ditemukan');

      const priceUuids: string[] = [];
      const variantUuids: string[] = [];

      if (product.prices && product.prices.length > 0) priceUuids.push(...product.prices.map(p => p.uuid));
      if (product.variants && product.variants.length > 0) {
        variantUuids.push(...product.variants.map(v => v.uuid));
        product.variants.forEach(v => { if (v.prices && v.prices.length > 0) priceUuids.push(...v.prices.map(vp => vp.uuid)); });
      }

      if (priceUuids.length > 0) {
        await manager.update(ProductPriceEntity, priceUuids, { deletedBy: userId });
        await manager.softDelete(ProductPriceEntity, priceUuids);
      }

      if (variantUuids.length > 0) {
        await manager.update(ProductVariantEntity, variantUuids, { deletedBy: userId });
        await manager.softDelete(ProductVariantEntity, variantUuids);
      }

      await manager.update(ProductEntity, uuid, { deletedBy: userId });
      await manager.softDelete(ProductEntity, uuid);
      return { message: 'Produk berhasil dihapus', deletedProductUuid: uuid };
    });
  }

  // --- PERUBAHAN UTAMA DI FIND-ALL & FIND-ONE ---
  async findAll(page: number, limit: number, search: string, storeUuid: string) {
    const skip = (page - 1) * limit;
    let whereCondition: any;

    if (search) {
      whereCondition = [
        { name: ILike(`%${search}%`), storeUuid: storeUuid },
        { barcode: ILike(`%${search}%`), storeUuid: storeUuid },
      ];
    }

    const [data, total] = await this.productRepo.findAndCount({
      where: whereCondition,
      relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves', 'brand'],
      order: { name: 'ASC' },
      skip: skip,
      take: limit,
    });

    // 1. Ambil Data Stok dari Jurnal
    const productUuids = data.map(p => p.uuid);
    const stockMap = await this.journalStokService.calculateStockFromJournal(productUuids, storeUuid);

    // 2. Gabungkan stok ke dalam response data
    data.forEach(product => {
        // Lewati proses injeksi stok jika isManageStock false
        if (product.isManageStock === false) {
            (product as any).stock = 0;
            if (product.variants) {
                product.variants.forEach(v => (v as any).stock = 0);
            }
            return;
        }

        if (product.variants && product.variants.length > 0) {
            let totalVariantStock = 0;
            product.variants.forEach(variant => {
                const mapKey = `${product.uuid}_${variant.uuid}`;
                const vStock = stockMap.get(mapKey) || 0;
                (variant as any).stock = vStock; 
                totalVariantStock += vStock;
            });
            (product as any).stock = totalVariantStock; 
        } else {
            const mapKey = `${product.uuid}_null`;
            (product as any).stock = stockMap.get(mapKey) || 0; 
        }
    });

    return {
      data,
      meta: { totalItems: total, itemCount: data.length, itemsPerPage: limit, totalPages: Math.ceil(total / limit), currentPage: page }
    };
  }

  async findOne(uuid: string, storeUuid: string) {
    const product = await this.productRepo.findOne({
      where: { uuid },
      relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves', 'brand'],
    });

    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    // Jika tidak kelola stok, return 0
    if (product.isManageStock === false) {
        (product as any).stock = 0;
        if (product.variants) product.variants.forEach(v => (v as any).stock = 0);
        return product;
    }

    // Kalkulasi Stok untuk 1 produk ini
    const stockMap = await this.journalStokService.calculateStockFromJournal([uuid], storeUuid);

    if (product.variants && product.variants.length > 0) {
        let totalVariantStock = 0;
        product.variants.forEach(variant => {
            const vStock = stockMap.get(`${uuid}_${variant.uuid}`) || 0;
            (variant as any).stock = vStock;
            totalVariantStock += vStock;
        });
        (product as any).stock = totalVariantStock;
    } else {
        (product as any).stock = stockMap.get(`${uuid}_null`) || 0;
    }

    return product;
  }

  async findByBarcode(barcode: string, storeUuid: string) {
    let product = await this.productRepo.findOne({
      where: { 
        barcode: barcode, 
        uuid: Like(`%${storeUuid}%`) 
      },
      relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves', 'brand'],
    });

    if (!product) {
      const variant = await this.productVariantRepo.findOne({
        where: { barcode },
        relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves', 'brand'],
      });
      
      if (variant && variant.product && variant.product.uuid.includes(storeUuid)) { 
        product = await this.productRepo.findOne({
            where: { uuid: variant.product.uuid },
            relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves', 'brand'],
        });
        
        return { ...product, matchedVariantUuid: variant.uuid };
      }
    }

    if (!product) throw new NotFoundException('Produk dengan barcode ini tidak ditemukan');
    
    return product;
  }
}