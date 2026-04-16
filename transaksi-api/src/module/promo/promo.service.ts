import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PromoEntity } from 'src/common/entities/promo/promo.entity';
import { IsNull, Repository } from 'typeorm';
import { generatePromoUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class PromoService {
  constructor(
    @Inject('PROMO_REPOSITORY')
    private promoRepository: Repository<PromoEntity>,
  ) {}

  async create(data: any, storeUuid: string) {
    const newUuid = generatePromoUuid(storeUuid);
    const promoData = {
      ...data,
      uuid: newUuid,
    };
    const promo = this.promoRepository.create(promoData);
    return await this.promoRepository.save(promo);
  }

  async findAll(storeUuid: string) {
    return await this.promoRepository.find({ 
        where: { deleted_at: IsNull() }, 
        order: { created_at: 'DESC' } 
    });
  }

  async findOne(uuid: string) {
    const promo = await this.promoRepository.findOne({ 
        where: { uuid, deleted_at: IsNull() } 
    });
    if (!promo) throw new NotFoundException('Promo tidak ditemukan');
    return promo;
  }

  async update(uuid: string, data: any) {
    await this.findOne(uuid);
    delete data.uuid;
    await this.promoRepository.update({ uuid }, data);
    return this.findOne(uuid);
  }

  async remove(uuid: string) {
    const promo = await this.findOne(uuid);
    promo.deleted_at = new Date();
    return await this.promoRepository.save(promo);
  }
}