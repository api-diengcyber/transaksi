
import { DataSource } from 'typeorm';
import { ProductCategoryEntity } from './product_category.entity';

export const productCategoryProvider = [
  {
    provide: 'PRODUCT_CATEGORY_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductCategoryEntity),
    inject: ['DATA_SOURCE'],
  },
];
