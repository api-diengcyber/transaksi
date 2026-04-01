// shelve.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ShelveEntity } from '../../common/entities/shelve/shelve.entity';
import { CreateShelveDto } from './dto/create-shelve.dto';
import { generateWarehouseUuid } from '../../common/utils/generate_uuid_util';

@Injectable()
export class ShelveService {
  constructor(@Inject('SHELVE_REPOSITORY') private repo: Repository<ShelveEntity>) {}

  async create(dto: CreateShelveDto, storeUuid: string, userId?: string) {
    const data = this.repo.create({ uuid: generateWarehouseUuid(storeUuid), ...dto, createdBy: userId });
    return await this.repo.save(data);
  }

  async findAll() {
    return await this.repo.find({ relations: ['warehouse'], order: { name: 'ASC' } });
  }
}
