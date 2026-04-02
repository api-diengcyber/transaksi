// transaksi-api/src/module/product/product.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ILike, Repository, DataSource } from 'typeorm';
import { ProductEntity } from '../../common/entities/product/product.entity';
import { ProductVariantEntity } from '../../common/entities/product_variant/product_variant.entity';
import { ProductPriceEntity } from '../../common/entities/product_price/product_price.entity'; 
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
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
    private readonly journalStokService: JournalStokService, 
  ) {}

  async create(dto: CreateProductDto, storeUuid: string, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const productUuid = generateProductUuid(storeUuid);

      // MAPPING HARGA UTAMA
      const mappedPrices = dto.prices?.map((p) => ({
        uuid: generatePriceUuid(storeUuid),
        priceGroupUuid: p.priceGroupUuid, 
        name: p.name,
        price: p.price || 0,
        minQty: p.minQty || 1, 
        createdBy: userId,
      })) || [];

      // MAPPING VARIAN
      const mappedVariants = dto.variants?.map((v) => ({
        uuid: generateVariantUuid(storeUuid),
        name: v.name,
        barcode: v.barcode,
        createdBy: userId, // Varian entity juga TIDAK punya kolom stock
        prices: v.prices?.map((vp) => ({
          uuid: generatePriceUuid(storeUuid),
          priceGroupUuid: vp.priceGroupUuid, 
          name: vp.name,
          price: vp.price || 0,
          minQty: vp.minQty || 1, 
          createdBy: userId,
        })) || [],
      })) || [];

      const mappedShelves = dto.shelveUuids?.map(uuid => ({ uuid } as ShelveEntity)) || [];

      // 1. Buat instance Produk (TANPA MENGISI STOCK KE DATABASE)
      const newProduct = manager.create(ProductEntity, {
        uuid: productUuid,
        name: dto.name,
        barcode: dto.barcode,
        unitUuid: dto.unitUuid,
        categoryUuid: dto.categoryUuid,
        conversionQty: dto.conversionQty || 1,
        variants: mappedVariants,
        prices: mappedPrices, 
        shelves: mappedShelves,
        createdBy: userId,
      });

      const savedProduct = await manager.save(newProduct);

      // 2. PROSES STOK AWAL SEBAGAI 'STOCK IN'
      const inItems: any[] = [];
      const initialStock = dto.stock || 0;
      
      if (initialStock > 0) {
        inItems.push({
          productUuid: productUuid,
          unitUuid: dto.unitUuid,
          qty: initialStock
        });
      }

      if (dto.variants && dto.variants.length > 0) {
        dto.variants.forEach((v, index) => {
          const vStock = v.stock || 0; 
          if (vStock > 0) {
            inItems.push({
              productUuid: productUuid,
              variantUuid: mappedVariants[index].uuid,
              unitUuid: dto.unitUuid,
              qty: vStock
            });
          }
        });
      }

      // Jika ada stok awal yang diinput kasir saat buat produk, catat di Jurnal
      if (inItems.length > 0) {
        await this.journalStokService.stockIn(inItems, userId, manager, storeUuid);
      }

      return savedProduct;
    });
  }

  async update(uuid: string, dto: UpdateProductDto, storeUuid: string, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(ProductEntity, {
        where: { uuid },
        relations: ['variants', 'prices', 'variants.prices', 'shelves'],
      });

      if (!product) throw new NotFoundException('Produk tidak ditemukan');

      // Update field produk utama
      product.name = dto.name ?? product.name;
      product.barcode = dto.barcode ?? product.barcode;
      product.unitUuid = dto.unitUuid ?? product.unitUuid;
      product.categoryUuid = dto.categoryUuid ?? product.categoryUuid;
      product.conversionQty = dto.conversionQty ?? product.conversionQty;
      product.updatedBy = userId;

      // UPDATE HARGA UTAMA
      if (dto.prices) {
        product.prices = dto.prices.map((p) => ({
          uuid: p.uuid || generatePriceUuid(storeUuid),
          priceGroupUuid: p.priceGroupUuid,
          name: p.name,
          price: p.price || 0,
          minQty: p.minQty || 1, 
          updatedBy: p.uuid ? userId : null,
          createdBy: p.uuid ? undefined : userId,
        } as ProductPriceEntity));
      } else if (dto.prices === null) {
        product.prices = [];
      }

      const inItems: any[] = []; 

      // UPDATE VARIAN
      if (dto.variants) {
        product.variants = dto.variants.map((v) => {
          const isNewVariant = !v.uuid;
          const variantUuid = v.uuid || generateVariantUuid(storeUuid);
          
          // JIKA ADA VARIAN BARU yang dibuat saat menu Edit, dan langsung diisi stok awalnya
          if (isNewVariant && (v.stock || 0) > 0) {
             inItems.push({
                productUuid: uuid,
                variantUuid: variantUuid,
                unitUuid: dto.unitUuid || product.unitUuid,
                qty: v.stock
             });
          }

          return {
            uuid: variantUuid,
            name: v.name,
            barcode: v.barcode,
            updatedBy: v.uuid ? userId : null,
            createdBy: v.uuid ? undefined : userId,
            prices: v.prices?.map((vp) => ({
              uuid: vp.uuid || generatePriceUuid(storeUuid),
              priceGroupUuid: vp.priceGroupUuid, 
              name: vp.name,
              price: vp.price || 0,
              minQty: vp.minQty || 1, 
              updatedBy: vp.uuid ? userId : null,
              createdBy: vp.uuid ? undefined : userId,
            } as ProductPriceEntity)) || [],
          } as ProductVariantEntity;
        });
      } else if (dto.variants === null) {
        product.variants = []; 
      }

      // UPDATE RAK
      if (dto.shelveUuids) {
        product.shelves = dto.shelveUuids.map(id => ({ uuid: id } as ShelveEntity));
      } else if (dto.shelveUuids === null) {
        product.shelves = [];
      }

      const savedProduct = await manager.save(ProductEntity, product);

      // Eksekusi Stok Masuk untuk varian yang baru saja dibuat
      if (inItems.length > 0) {
        await this.journalStokService.stockIn(inItems, userId, manager, storeUuid);
      }

      return savedProduct;
    });
  }

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
      relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves'],
      order: { name: 'ASC' },
      skip: skip,
      take: limit,
    });

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }
    };
  }

  async findOne(uuid: string) {
    const product = await this.productRepo.findOne({
      where: { uuid },
      relations: ['variants', 'unit', 'prices', 'variants.prices', 'shelves'],
    });

    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    return product;
  }

  async remove(uuid: string, userId?: string) {
    const product = await this.findOne(uuid);
    product.deletedBy = userId;
    await this.productRepo.save(product);
    return await this.productRepo.softDelete(uuid);
  }
}