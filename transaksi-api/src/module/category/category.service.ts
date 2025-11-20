import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { CategoryEntity } from "src/common/entities/category/category.entity";
import { Repository, DataSource } from "typeorm";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/create-category.dto";

@Injectable()
export class CategoryService {
  constructor(
    @Inject('CATEGORY_REPOSITORY')
    private readonly categoryRepo: Repository<CategoryEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) { }

  // ============================
  // CREATE CATEGORY
  // ============================
  async create(payload: CreateCategoryDto, userId: string) {
    let parentCategory: any = null;

    if (payload.parentUuid) {
      parentCategory = await this.categoryRepo.findOne({
        where: { uuid: payload.parentUuid },
      });

      if (!parentCategory) {
        throw new NotFoundException(`Parent category with UUID ${payload.parentUuid} not found`);
      }
    }

    const newCategory = this.categoryRepo.create({
      name: payload.name,
      parent: parentCategory ?? null,
      createdBy: userId,
    });

    return await this.categoryRepo.save(newCategory);
  }

  // ============================
  // GET ALL
  // ============================
  async findAll() {
    const categorys = await this.categoryRepo.createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent')
      .loadRelationCountAndMap('category.totalItems', 'category.productCategorys')
      .orderBy('category.createdAt', 'DESC')
      .getMany();

    return categorys;
  }

  // ============================
  // FIND ONE
  // ============================
  async findOne(uuid: string) {
    const category = await this.categoryRepo.findOne({
      where: { uuid },
      relations: [
        'parent',
        'children',
        'productCategorys',
        'productCategorys.product'
      ]
    });

    if (!category) {
      throw new NotFoundException(`Category with UUID ${uuid} not found`);
    }
    return category;
  }

  // ============================
  // UPDATE CATEGORY
  // ============================
  async update(uuid: string, payload: UpdateCategoryDto, userId: string) {
    const category = await this.findOne(uuid);

    // Update name
    if (payload.name) {
      category.name = payload.name;
    }

    // Update parent
    if (payload.parentUuid !== undefined) {
      if (payload.parentUuid === uuid) {
        throw new BadRequestException("Category cannot be a parent of itself");
      }

      if (payload.parentUuid === null) {
        category.parent = null; // remove parent
      } else {
        const parent = await this.categoryRepo.findOne({ where: { uuid: payload.parentUuid } });
        if (!parent) {
          throw new NotFoundException(`Parent with UUID ${payload.parentUuid} not found`);
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
  async remove(uuid: string, userId: string) {
    const category = await this.findOne(uuid);

    category.deletedBy = userId;
    await this.categoryRepo.save(category);

    return await this.categoryRepo.softDelete(uuid);
  }

  async restore(uuid: string) {
    return await this.categoryRepo.restore(uuid);
  }
}
