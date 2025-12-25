import { DataSource } from 'typeorm';
import { CourierRoute } from './courier_route.entity';

export const courierRouteProviders = [
  {
    provide: 'COURIER_ROUTE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(CourierRoute),
    inject: ['DATA_SOURCE'],
  },
];