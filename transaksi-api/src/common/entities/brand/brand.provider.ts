
import { DataSource } from 'typeorm';
import { BrandEntity } from './brand.entity';

export const brandProvider = [
  {
    provide: 'BRAND_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(BrandEntity),
    inject: ['DATA_SOURCE'],
  },
];
