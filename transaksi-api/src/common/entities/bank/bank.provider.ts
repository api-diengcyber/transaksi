import { DataSource } from 'typeorm';
import { Bank } from './bank.entity';

export const bankProviders = [
  {
    provide: 'BANK_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Bank),
    inject: ['DATA_SOURCE'],
  },
];