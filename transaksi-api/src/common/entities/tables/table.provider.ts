import { DataSource } from 'typeorm';
import { TableEntity } from './table.entity';

export const tableProvider = [
  {
    provide: 'TABLE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(TableEntity),
    inject: ['DATA_SOURCE'],
  },
];