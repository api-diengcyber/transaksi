
import { DataSource } from 'typeorm';
import { ProductShelveEntity } from './product_shelve.entity';

export const productShelveProvider = [
  {
    provide: 'PRODUCT_SHELVE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductShelveEntity),
    inject: ['DATA_SOURCE'],
  },
];
