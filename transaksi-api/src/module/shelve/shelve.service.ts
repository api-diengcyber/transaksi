import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { Repository, DataSource, Like } from "typeorm";
import { CreateShelveDto, UpdateShelveDto } from "./dto/create-shelve.dto";
import { ProductShelveEntity, ShelveType } from "src/common/entities/product_shelve/product_shelve.entity";
import { generateShelveUuid } from "src/common/utils/generate_uuid_util";

@Injectable()
export class ShelveService {
  constructor(
    @Inject('PRODUCT_SHELVE_REPOSITORY')
    private readonly shelveRepo: Repository<ProductShelveEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
  ) { }
  
  // [UPDATED] Tambah storeUuid
  async create(payload: CreateShelveDto, userId: string, storeUuid: string) {
    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for shelve creation.');
    }
    const customShelveUuid = generateShelveUuid(storeUuid);

    const newShelve = this.shelveRepo.create({
      uuid: customShelveUuid, // <-- SET UUID BARU
      ...payload,
      createdBy: userId,
    });
    return await this.shelveRepo.save(newShelve);
  }

  async findAll(storeUuid: string, type?: ShelveType) {
    const whereCondition: any = {};

    // Filter by Store UUID pattern
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-SHL-%`);
    }

    // [BARU] Filter by Type jika diminta
    if (type) {
      whereCondition.type = type;
    }
    
    const shelves = await this.shelveRepo.createQueryBuilder('shelve')
      .where(whereCondition)
      .loadRelationCountAndMap('shelve.totalItems', 'shelve.productShelves')
      .orderBy('shelve.isDefault', 'DESC') // Tampilkan Default/Gudang paling atas
      .addOrderBy('shelve.createdAt', 'DESC')
      .getMany();

    return shelves;
  }

  // [UPDATED] Tambah storeUuid untuk validasi kepemilikan
  async findOne(uuid: string, storeUuid?: string) {
    const whereCondition: { uuid: any } = { uuid };
    
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-SHL-%`);
    }
    
    const shelve = await this.shelveRepo.findOne({
      where: whereCondition,
      relations: [
        'productShelves',
        'productShelves.product',
        'productShelves.unit'
      ]
    });

    // [UPDATED] Validasi tambahan: pastikan hasil match dengan prefix jika storeUuid ada
    if (!shelve || (storeUuid && !shelve.uuid.startsWith(`${storeUuid}-SHL-`))) { 
      return null;
    }

    return shelve;
  }

  // [UPDATED] Tambah storeUuid dan gunakan di findOne
  async update(uuid: string, payload: UpdateShelveDto, userId: string, storeUuid: string) {
    const shelve = await this.findOne(uuid, storeUuid); // <-- Gunakan findOne dengan filter storeUuid

    if (!shelve) {
      throw new NotFoundException(`Shelve with UUID ${uuid} not found in this store`);
    }
    
    if (payload.name) shelve.name = payload.name;
    if (payload.description) shelve.description = payload.description;
    if (payload.capacity) shelve.capacity = payload.capacity;
    
    shelve.updatedBy = userId;

    return await this.shelveRepo.save(shelve);
  }

  // [UPDATED] Tambah storeUuid dan gunakan di findOne
  async remove(uuid: string, userId: string, storeUuid: string) {
    const shelve = await this.findOne(uuid, storeUuid); // <-- Gunakan findOne dengan filter storeUuid

    if (!shelve) {
      throw new NotFoundException(`Shelve with UUID ${uuid} not found in this store`);
    }

    // Update deletedBy sebelum soft delete
    shelve.deletedBy = userId;
    await this.shelveRepo.save(shelve);

    return await this.shelveRepo.softDelete(uuid);
  }

  // [UPDATED] Tambah storeUuid dan gunakan di findOne
  async restore(uuid: string, storeUuid: string) {
     const shelve = await this.findOne(uuid, storeUuid);

    if (!shelve) {
      throw new NotFoundException(`Shelve with UUID ${uuid} not found in this store`);
    }
    
    return await this.shelveRepo.restore(uuid);
  }
}