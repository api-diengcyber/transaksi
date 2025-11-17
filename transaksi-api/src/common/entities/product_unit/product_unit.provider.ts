
import { DataSource } from 'typeorm';
import { ProductUnitEntity } from './product_unit.entity';

export const productUnitProvider = [
  {
    provide: 'PRODUCT_UNIT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductUnitEntity),
    inject: ['DATA_SOURCE'],
  },
];
