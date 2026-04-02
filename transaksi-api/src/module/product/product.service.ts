import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ILike, Repository } from 'typeorm';
import { ProductEntity } from '../../common/entities/product/product.entity';
import { ProductVariantEntity } from '../../common/entities/product_variant/product_variant.entity';
// 1. TAMBAHKAN IMPORT ENTITY HARGA
import { ProductPriceEntity } from '../../common/entities/product_price/product_price.entity'; 
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
// 2. PASTIKAN IMPORT UUID GENERATOR UNTUK HARGA (Bisa disesuaikan dengan fungsi yang Anda miliki)
import { generateProductUuid, generateVariantUuid, generatePriceUuid } from '../../common/utils/generate_uuid_util'; 

@Injectable()
export class ProductService {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async create(dto: CreateProductDto, storeUuid: string, userId?: string) {
    const productUuid = generateProductUuid(storeUuid);

    // MAPPING TAMBAHAN: Harga Produk Utama (Jika tidak pakai varian)
    const mappedPrices = dto.prices?.map((p) => ({
      uuid: generatePriceUuid(storeUuid), // Gunakan helper uuid Anda, misal: generatePriceUuid() jika ada
      name: p.name,
      price: p.price || 0,
      createdBy: userId,
    })) || [];

    // 1. Mapping Varian
    const mappedVariants = dto.variants?.map((v) => ({
      uuid: generateVariantUuid(storeUuid),
      name: v.name,
      barcode: v.barcode,
      stock: v.stock || 0,
      createdBy: userId,
      // MAPPING TAMBAHAN: Harga di dalam masing-masing varian
      prices: v.prices?.map((vp) => ({
        uuid: generatePriceUuid(storeUuid),
        name: vp.name,
        price: vp.price || 0,
        createdBy: userId,
      })) || [],
    })) || []; 

    // 2. Buat instance Produk
    const newProduct = this.productRepo.create({
      uuid: productUuid,
      name: dto.name,
      barcode: dto.barcode,
      // stock: dto.stock || 0,
      unitUuid: dto.unitUuid,
      conversionQty: dto.conversionQty || 1,
      // Hubungkan relasi varian dan harga
      variants: mappedVariants,
      prices: mappedPrices, // <-- TAMBAHAN RELASI HARGA UTAMA
      createdBy: userId,
      // (Tambahkan mapping shelves, parent, dan child sesuai logika Anda)
    });

    // 3. Simpan
    return await this.productRepo.save(newProduct);
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
      // TAMBAHAN: Load relasi prices dan prices di dalam varian
      relations: ['variants', 'unit', 'prices', 'variants.prices'], 
      order: { 
        name: 'ASC' 
      },
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
      // TAMBAHAN: Load relasi harga agar muncul saat modal Edit dibuka
      relations: ['variants', 'unit', 'prices', 'variants.prices'], 
    });

    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    return product;
  }

  async update(uuid: string, dto: UpdateProductDto, storeUuid: string, userId?: string) {
    // 1. Cari produk lama beserta varian dan harganya
    const product = await this.productRepo.findOne({
      where: { uuid },
      relations: ['variants', 'prices', 'variants.prices'], // <-- TAMBAHAN
    });

    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    // 2. Update field produk utama
    product.name = dto.name ?? product.name;
    product.barcode = dto.barcode ?? product.barcode;
    product.unitUuid = dto.unitUuid ?? product.unitUuid;
    product.conversionQty = dto.conversionQty ?? product.conversionQty;
    product.updatedBy = userId;

    // TAMBAHAN: Update / Sync Harga Utama
    if (dto.prices) {
      product.prices = dto.prices.map((p) => ({
        uuid: p.uuid || generatePriceUuid(storeUuid),
        name: p.name,
        price: p.price || 0,
        updatedBy: p.uuid ? userId : null,
        createdBy: p.uuid ? undefined : userId,
      } as ProductPriceEntity));
    } else if (dto.prices === null) {
       product.prices = [];
    }

    // 3. Update / Sync Varian & Harga di dalamnya
    if (dto.variants) {
      product.variants = dto.variants.map((v) => {
        return {
          uuid: v.uuid || generateVariantUuid(storeUuid),
          name: v.name,
          barcode: v.barcode,
          stock: v.stock || 0,
          updatedBy: v.uuid ? userId : null,
          createdBy: v.uuid ? undefined : userId,
          // Sync harga di dalam varian ini
          prices: v.prices?.map((vp) => ({
            uuid: vp.uuid || generatePriceUuid(storeUuid),
            name: vp.name,
            price: vp.price || 0,
            updatedBy: vp.uuid ? userId : null,
            createdBy: vp.uuid ? undefined : userId,
          } as ProductPriceEntity)) || [],
        } as ProductVariantEntity;
      });
    } else {
      product.variants = []; 
    }

    // 4. Simpan perubahan.
    return await this.productRepo.save(product);
  }

  async remove(uuid: string, userId?: string) {
    const product = await this.findOne(uuid);
    product.deletedBy = userId;
    await this.productRepo.save(product);
    return await this.productRepo.softDelete(uuid);
  }
}