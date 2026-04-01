
import { DataSource } from 'typeorm';
import { ProductPriceEntity } from './product_price.entity';

export const productPriceProvider = [
  {
    provide: 'PRODUCT_PRICE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductPriceEntity),
    inject: ['DATA_SOURCE'],
  },
];
