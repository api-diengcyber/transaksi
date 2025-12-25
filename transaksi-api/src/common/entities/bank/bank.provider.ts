import { DataSource } from 'typeorm';
import { BankEntity } from './bank.entity';

export const bankProviders = [
  {
    provide: 'BANK_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(BankEntity),
    inject: ['DATA_SOURCE'],
  },
];