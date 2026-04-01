// warehouse.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WarehouseEntity } from '../../common/entities/warehouse/warehouse.entity';
import { generateWarehouseUuid } from '../../common/utils/generate_uuid_util';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(@Inject('WAREHOUSE_REPOSITORY') private repo: Repository<WarehouseEntity>) {}

  async create(dto: CreateWarehouseDto, storeUuid: string, userId?: string) {
    const data = this.repo.create({ uuid: generateWarehouseUuid(storeUuid), ...dto, createdBy: userId });
    return await this.repo.save(data);
  }

  async findAll() {
    return await this.repo.find({ relations: ['shelves'], order: { name: 'ASC' } });
  }
}
