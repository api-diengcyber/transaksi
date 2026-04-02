
import { DataSource } from 'typeorm';
import { PriceGroupEntity } from './price_group.entity';

export const priceGroupProviders = [
  {
    provide: 'PRICE_GROUP_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(PriceGroupEntity),
    inject: ['DATA_SOURCE'],
  },
];
