import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Courier } from '../../common/entities/courier/courier.entity';
import { CourierRoute } from 'src/common/entities/courier_routes/courier_route.entity';

@Injectable()
export class CourierService {
  constructor(
    @Inject('COURIER_REPOSITORY')
    private courierRepository: Repository<Courier>,
    @Inject('COURIER_ROUTE_REPOSITORY')
    private courierRouteRepository: Repository<CourierRoute>,
  ) { }

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

  async findRoutes(storeId: string) {
    return this.courierRouteRepository.find({
      where: { store_id: storeId, is_active: true },
      relations: ['courier'] // Supaya nama kurirnya muncul
    });
  }

  async createRoute(data: { courier_uuid: string, origin: string, destination: string, price: number }, storeId: string) {
    return this.courierRouteRepository.save({
      ...data,
      store_id: storeId
    });
  }
}