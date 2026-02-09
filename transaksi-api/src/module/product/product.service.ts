import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, Like, In } from 'typeorm';
import { ProductEntity } from 'src/common/entities/product/product.entity';
import { generateLocalUuid } from 'src/common/utils/generate_uuid_util';

// Import DTOs
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CategoryEntity } from 'src/common/entities/category/category.entity';

@Injectable()
export class ProductService {
  constructor(
    @Inject('PRODUCT_REPOSITORY')
    private readonly productRepo: Repository<ProductEntity>,
    @Inject('CATEGORY_REPOSITORY')
    private readonly categoryRepo: Repository<CategoryEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) { }
  
  async findAll(page: number, limit: number, search: string) {
    const skip = (page - 1) * limit;
    const whereCondition: any = {};
    if (search) whereCondition.name = Like(`%${search}%`);

    const [data, total] = await this.productRepo.findAndCount({
      where: whereCondition,
      relations: ['categories'],
      take: limit,
      skip: skip,
      order: { createdAt: 'DESC' }
    });

    return { data, meta: { total, page, limit } };
  }

  async findOne(uuid: string) {
    const product = await this.productRepo.findOne({ 
        where: { uuid },
        relations: ['categories'] // Penting: Load relasi categories
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(payload: CreateProductDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newProduct = new ProductEntity();
      newProduct.uuid = generateLocalUuid();
      newProduct.name = payload.name;
      newProduct.barcode = payload.barcode ?? "";

      // --- LOGIC ASSIGN MANY CATEGORIES ---
      if (payload.categoryUuids && payload.categoryUuids.length > 0) {
        // Cari entity category berdasarkan array UUID
        const categories = await this.categoryRepo.findBy({
            uuid: In(payload.categoryUuids)
        });
        newProduct.categories = categories;
      }
      // ------------------------------------

      const saved = await queryRunner.manager.save(ProductEntity, newProduct);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message || 'Gagal membuat produk');
    } finally {
      await queryRunner.release();
    }
  }

  async update(uuid: string, payload: UpdateProductDto) {
    // Load produk existing beserta kategorinya
    const product = await this.productRepo.findOne({ 
        where: { uuid }, 
        relations: ['categories'] 
    });
    
    if (!product) throw new NotFoundException('Produk tidak ditemukan');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (payload.name) product.name = payload.name;
      if (payload.barcode !== undefined) product.barcode = payload.barcode;

      // --- LOGIC UPDATE MANY CATEGORIES ---
      if (payload.categoryUuids) {
        // Cari entity category baru
        const categories = await this.categoryRepo.findBy({
            uuid: In(payload.categoryUuids)
        });
        // Replace kategori lama dengan yang baru
        product.categories = categories;
      }
      // ------------------------------------

      const updated = await queryRunner.manager.save(ProductEntity, product);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(err.message || 'Gagal update produk');
    } finally {
      await queryRunner.release();
    }
  }

  async delete(uuid: string) {
    const product = await this.findOne(uuid);
    return await this.productRepo.softRemove(product);
  }
}