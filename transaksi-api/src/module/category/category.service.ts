import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { ProductCategoryEntity } from "src/common/entities/product_category/product_category.entity";
import { Repository, DataSource, Like, EntityManager } from "typeorm";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/create-category.dto";

// [BARU] Helper untuk menghasilkan pengenal lokal
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
// [BARU] Helper untuk menghasilkan UUID dengan prefix Store (Contoh format: [storeUuid]-CAT-[local_identifier])
const generateCategoryUuid = (storeUuid: string) => `${storeUuid}-CAT-${generateLocalUuid()}`;

@Injectable()
export class CategoryService {
  constructor(
    @Inject('PRODUCT_CATEGORY_REPOSITORY')
    private readonly categoryRepo: Repository<ProductCategoryEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) { }

  // ============================
  // [BARU] INITIALIZE RESTAURANT CATEGORIES
  // ============================
  async initializeRestaurantCategories(userId: string, storeUuid: string, manager: EntityManager) {
    const defaultCategories = [
        { name: 'Makanan', isRestaurant: true },
        { name: 'Minuman', isRestaurant: true },
        { name: 'Bahan', isRestaurant: true },
    ];
    
    const categoryEntities = defaultCategories.map(cat => {
        const customCategoryUuid = generateCategoryUuid(storeUuid);
        return manager.create(ProductCategoryEntity, {
            uuid: customCategoryUuid,
            name: cat.name,
            isRestaurant: cat.isRestaurant, // Set true
            createdBy: userId,
        });
    });
    
    await manager.save(categoryEntities);
    return categoryEntities;
  }

  // ============================
  // CREATE CATEGORY
  // ============================
  // [UPDATED] Terima storeUuid
  async create(payload: CreateCategoryDto, userId: string, storeUuid: string) { 
    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for category creation.');
    }

    const customCategoryUuid = generateCategoryUuid(storeUuid); // <-- PANGGIL HELPER BARU

    let parentCategory: any = null;

    if (payload.parentUuid) {
      // [UPDATED] Gunakan findOne dengan filter storeUuid
      parentCategory = await this.findOne(payload.parentUuid, storeUuid); 

      if (!parentCategory) {
        throw new NotFoundException(`Parent category with UUID ${payload.parentUuid} not found in this store`); // <-- Pesan disesuaikan
      }
    }

    const newCategory = this.categoryRepo.create({
      uuid: customCategoryUuid,
      name: payload.name,
      parent: parentCategory ?? null,
      createdBy: userId,
    });

    return await this.categoryRepo.save(newCategory);
  }

  // ============================
  // GET ALL
  // ============================
  // [UPDATED] Terima storeUuid
  async findAll(storeUuid: string) {
    const whereCondition: { uuid?: any } = {};

    // [BARU] Filtering berdasarkan UUID dengan prefix storeUuid
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-CAT-%`);
    }

    const categorys = await this.categoryRepo.createQueryBuilder('category')
      .where(whereCondition) // <-- TAMBAH FILTER
      .leftJoinAndSelect('category.parent', 'parent')
      .loadRelationCountAndMap('category.totalItems', 'category.productCategorys')
      .orderBy('category.createdAt', 'DESC')
      .addSelect('category.isRestaurant')
      .getMany();

    return categorys;
  }

  // ============================
  // FIND ONE
  // ============================
  // [UPDATED] Terima storeUuid untuk validasi kepemilikan
  async findOne(uuid: string, storeUuid?: string) {
    const whereCondition: { uuid: any } = { uuid };

    // Filtering jika storeUuid ada. Gunakan LIKE untuk filter berdasarkan prefix store.
    if (storeUuid) {
      // Jika storeUuid ada, kita pastikan UUID yang dicari match dengan prefix.
      whereCondition.uuid = Like(`${storeUuid}-CAT-%`);
    }

    const category = await this.categoryRepo.findOne({
      where: whereCondition,
      relations: [
        'parent',
        'children',
        'productCategorys',
        'productCategorys.product'
      ]
    });

    // Validasi tambahan: jika tidak ditemukan ATAU ditemukan tapi tidak match prefix (jika storeUuid ada)
    if (!category || (storeUuid && !category.uuid.startsWith(`${storeUuid}-CAT-`))) { 
      return null;
    }

    return category;
  }

  // ============================
  // UPDATE CATEGORY
  // ============================
  // [UPDATED] Tambah storeUuid dan gunakan di findOne
  async update(uuid: string, payload: UpdateCategoryDto, userId: string, storeUuid: string) {
    const category = await this.findOne(uuid, storeUuid); // <-- Gunakan findOne dengan filter storeUuid

    if (!category) {
        throw new NotFoundException(`Category with UUID ${uuid} not found in this store`);
    }

    // ... (Logika update name dan parent tetap sama, namun memanggil this.findOne untuk parent juga)

    // Update parent
    if (payload.parentUuid !== undefined) {
      if (payload.parentUuid === uuid) {
        throw new BadRequestException("Category cannot be a parent of itself");
      }

      if (payload.parentUuid === null) {
        category.parent = null; // remove parent
      } else {
        // [UPDATED] Gunakan findOne dengan filter storeUuid untuk validasi parent
        const parent = await this.findOne(payload.parentUuid, storeUuid); 
        if (!parent) {
          throw new NotFoundException(`Parent with UUID ${payload.parentUuid} not found in this store`);
        }
        category.parent = parent;
      }
    }

    category.updatedBy = userId;

    return await this.categoryRepo.save(category);
  }

  // ============================
  // DELETE
  // ============================
  // [UPDATED] Tambah storeUuid dan gunakan di findOne
  async remove(uuid: string, userId: string, storeUuid: string) {
    const category = await this.findOne(uuid, storeUuid); // <-- Gunakan findOne dengan filter storeUuid
    
    if (!category) {
        throw new NotFoundException(`Category with UUID ${uuid} not found in this store`);
    }

    category.deletedBy = userId;
    await this.categoryRepo.save(category);

    return await this.categoryRepo.softDelete(uuid);
  }

  async restore(uuid: string) {
    return await this.categoryRepo.restore(uuid);
  }
}
