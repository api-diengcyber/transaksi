
import { DataSource } from 'typeorm';
import { ProductVariantEntity } from './product_variant.entity';

export const productVariantProvider = [
  {
    provide: 'PRODUCT_VARIANT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductVariantEntity),
    inject: ['DATA_SOURCE'],
  },
];
