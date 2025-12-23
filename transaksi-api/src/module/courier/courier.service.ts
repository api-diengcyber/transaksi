import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Courier } from '../../common/entities/courier/courier.entity';

@Injectable()
export class CourierService {
  constructor(
    @Inject('COURIER_REPOSITORY')
    private courierRepository: Repository<Courier>,
  ) {}

  async findAll(storeId: string) {
    return this.courierRepository.find({
      where: { store_id: storeId, is_active: true },
    });
  }

  async create(name: string, storeId: string) {
    return this.courierRepository.save({ name, store_id: storeId });
  }

  async delete(id: string) {
    return this.courierRepository.update(id, { is_active: false });
  }
}