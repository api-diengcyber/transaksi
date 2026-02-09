import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { Repository, DataSource, Like, Not } from 'typeorm';
import { CategoryEntity } from 'src/common/entities/category/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { generateCategoryUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class CategoryService {
  constructor(
    @Inject('CATEGORY_REPOSITORY')
    private readonly categoryRepo: Repository<CategoryEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) {}

  // --- FIND ALL (Pagination & Search) ---
  async findAll(query: CategoryQueryDto) {
    const { page = 1, limit = 10, search = '' } = query;
    const skip = (page - 1) * limit;

    const whereCondition: any = {};
    if (search) {
      whereCondition.name = Like(`%${search}%`);
    }

    const [data, total] = await this.categoryRepo.findAndCount({
      where: whereCondition,
      relations: ['parent', 'children'], // Load Parent & Child untuk info lengkap
      take: limit,
      skip: skip,
      order: { createdAt: 'DESC' },
    });

    // Mapping agar response lebih rapi (opsional)
    const mappedData = data.map(cat => ({
      uuid: cat.uuid,
      name: cat.name,
      parentName: cat.parent ? cat.parent.name : null, // Info nama parent
      parentUuid: cat.parent ? cat.parent.uuid : null,
      childrenCount: cat.children ? cat.children.length : 0,
      createdAt: cat.createdAt
    }));

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        total_page: Math.ceil(total / limit),
      },
    };
  }

  // --- FIND ONE ---
  async findOne(uuid: string) {
    const category = await this.categoryRepo.findOne({
      where: { uuid },
      relations: ['parent', 'children', 'products'], // Load product juga jika perlu
    });

    if (!category) throw new NotFoundException(`Kategori dengan UUID ${uuid} tidak ditemukan`);
    return category;
  }

  // --- CREATE ---
  async create(payload: CreateCategoryDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newCategory = new CategoryEntity();
      newCategory.uuid = generateCategoryUuid();
      newCategory.name = payload.name;

      // Logic Parent
      if (payload.parentUuid) {
        const parent = await this.categoryRepo.findOneBy({ uuid: payload.parentUuid });
        if (!parent) throw new BadRequestException('Parent kategori tidak ditemukan');
        newCategory.parent = parent;
      }

      const saved = await queryRunner.manager.save(CategoryEntity, newCategory);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- UPDATE ---
  async update(uuid: string, payload: UpdateCategoryDto) {
    const category = await this.findOne(uuid); // Cek exist

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (payload.name) category.name = payload.name;

      // Logic Update Parent
      if (payload.parentUuid !== undefined) {
        if (payload.parentUuid === null) {
          // Jika dikirim null, berarti jadikan Root (Hapus Parent)
        //   category.parent = null; --- IGNORE ---
        } else {
          // Validasi Circular: Tidak boleh menjadikan diri sendiri sebagai parent
          if (payload.parentUuid === uuid) {
            throw new BadRequestException('Kategori tidak bisa menjadi parent bagi dirinya sendiri');
          }

          const parent = await this.categoryRepo.findOneBy({ uuid: payload.parentUuid });
          if (!parent) throw new BadRequestException('Parent kategori tidak ditemukan');
          
          category.parent = parent;
        }
      }

      const updated = await queryRunner.manager.save(CategoryEntity, category);
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- DELETE (Soft Delete) ---
  async delete(uuid: string) {
    const category = await this.findOne(uuid);
    
    // Validasi Opsional: Jangan hapus jika masih punya anak
    if (category.children && category.children.length > 0) {
       throw new BadRequestException('Tidak bisa menghapus kategori yang masih memiliki sub-kategori. Hapus/pindahkan sub-kategori terlebih dahulu.');
    }

    return await this.categoryRepo.softRemove(category);
  }
}