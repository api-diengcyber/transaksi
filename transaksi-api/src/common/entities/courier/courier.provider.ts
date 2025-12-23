import { DataSource } from 'typeorm';
import { Courier } from './courier.entity';

export const courierProviders = [
  {
    provide: 'COURIER_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Courier),
    inject: ['DATA_SOURCE'],
  },
];