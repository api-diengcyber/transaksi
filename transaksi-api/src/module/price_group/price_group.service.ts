import { Injectable, Inject } from '@nestjs/common';
import { Like, Repository } from 'typeorm';
import { PriceGroupEntity } from '../../common/entities/price_group/price_group.entity';
// (Pastikan Anda sudah membuat PriceGroupEntity dan provider-nya seperti yang dibahas sebelumnya)

@Injectable()
export class PriceGroupService {
  constructor(
    @Inject('PRICE_GROUP_REPOSITORY')
    private readonly repo: Repository<PriceGroupEntity>,
  ) {}

  async findAll(storeUuid: string) {
    return await this.repo.find({
      where: { 
        uuid: Like(`${storeUuid}%`) 
      },
      order: { name: 'ASC' },
    });
  }
}