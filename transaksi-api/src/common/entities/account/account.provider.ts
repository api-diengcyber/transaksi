import { DataSource } from 'typeorm';
import { AccountEntity } from './account.entity';

export const accountProviders = [
  {
    provide: 'ACCOUNT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(AccountEntity),
    inject: ['DATA_SOURCE'],
  },
];