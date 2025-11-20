import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { ShelveEntity } from "src/common/entities/shelve/shelve.entity";
import { Repository, DataSource } from "typeorm";
import { CreateShelveDto, UpdateShelveDto } from "./dto/create-shelve.dto";

@Injectable()
export class ShelveService {
  constructor(
    @Inject('SHELVE_REPOSITORY')
    private readonly shelveRepo: Repository<ShelveEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource, 
  ) {}

  async create(payload: CreateShelveDto, userId: string) {
    const newShelve = this.shelveRepo.create({
      ...payload,
      createdBy: userId,
    });
    return await this.shelveRepo.save(newShelve);
  }

  async findAll() {
    const shelves = await this.shelveRepo.createQueryBuilder('shelve')
      .loadRelationCountAndMap('shelve.totalItems', 'shelve.productShelves')
      .orderBy('shelve.createdAt', 'DESC')
      .getMany();

    return shelves;
  }

  async findOne(uuid: string) {
    const shelve = await this.shelveRepo.findOne({
      where: { uuid },
      relations: [
        'productShelves',
        'productShelves.product',
        'productShelves.unit'
      ] 
    });

    if (!shelve) {
      throw new NotFoundException(`Shelve with UUID ${uuid} not found`);
    }
    return shelve;
  }

  async update(uuid: string, payload: UpdateShelveDto, userId: string) {
    const shelve = await this.findOne(uuid);

    // Update fields
    if (payload.name) shelve.name = payload.name;
    if (payload.description) shelve.description = payload.description;
    if (payload.capacity) shelve.capacity = payload.capacity;
    
    shelve.updatedBy = userId;

    return await this.shelveRepo.save(shelve);
  }

  async remove(uuid: string, userId: string) {
    const shelve = await this.findOne(uuid);
    
    // Update deletedBy sebelum soft delete
    shelve.deletedBy = userId;
    await this.shelveRepo.save(shelve);

    return await this.shelveRepo.softDelete(uuid);
  }

  async restore(uuid: string) {
    return await this.shelveRepo.restore(uuid);
  }
}