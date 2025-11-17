
import { DataSource } from 'typeorm';
import { ProductStockEntity } from './product_stock.entity';

export const productStockProvider = [
  {
    provide: 'PRODUCT_STOCK_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductStockEntity),
    inject: ['DATA_SOURCE'],
  },
];
