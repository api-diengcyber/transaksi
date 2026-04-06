import { Injectable, Inject } from '@nestjs/common';
import { Like, Repository } from 'typeorm';
import { BrandEntity } from '../../common/entities/brand/brand.entity';
import { generateBrandUuid } from '../../common/utils/generate_uuid_util';

@Injectable()
export class BrandService {
  constructor(
    @Inject('BRAND_REPOSITORY')
    private brandRepository: Repository<BrandEntity>,
  ) {}

  async create(createBrandDto: any, storeUuid: string) {
    const brand = this.brandRepository.create({
      ...createBrandDto,
      uuid: await generateBrandUuid(storeUuid),
      storeUuid,
    });
    return await this.brandRepository.save(brand);
  }

  async findAll(storeUuid: string) {
    return await this.brandRepository.find({ 
        where: { 
            uuid: Like(`${storeUuid}%`) 
        },
    });
  }

  async update(uuid: string, updateBrandDto: any) {
    return await this.brandRepository.update({ uuid }, updateBrandDto);
  }

  async remove(uuid: string) {
    return await this.brandRepository.delete({ uuid });
  }
}