import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UnitEntity } from '../../common/entities/unit/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { generateUnitUuid } from '../../common/utils/generate_uuid_util';

@Injectable()
export class UnitService {
  constructor(
    @Inject('UNIT_REPOSITORY')
    private readonly unitRepository: Repository<UnitEntity>,
  ) {}

  async create(createUnitDto: CreateUnitDto, storeUuid: string, userId?: string) {
    const unit = this.unitRepository.create({
      uuid: generateUnitUuid(storeUuid),
      name: createUnitDto.name,
      createdBy: userId,
    });
    return await this.unitRepository.save(unit);
  }

  async findAll() {
    return await this.unitRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(uuid: string) {
    const unit = await this.unitRepository.findOne({ where: { uuid } });
    if (!unit) {
      throw new NotFoundException(`Satuan dengan UUID ${uuid} tidak ditemukan`);
    }
    return unit;
  }

  async update(uuid: string, updateUnitDto: UpdateUnitDto, userId?: string) {
    const unit = await this.findOne(uuid);
    
    unit.name = updateUnitDto.name ?? unit.name;
    unit.updatedBy = userId;

    return await this.unitRepository.save(unit);
  }

  async remove(uuid: string, userId?: string) {
    const unit = await this.findOne(uuid);
    unit.deletedBy = userId;
    await this.unitRepository.save(unit); 
    return await this.unitRepository.softDelete(uuid);
  }
}