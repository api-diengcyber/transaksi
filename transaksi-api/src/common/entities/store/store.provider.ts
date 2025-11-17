
import { DataSource } from 'typeorm';
import { StoreEntity } from './store.entity';

export const storeProvider = [
  {
    provide: 'STORE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(StoreEntity),
    inject: ['DATA_SOURCE'],
  },
];
