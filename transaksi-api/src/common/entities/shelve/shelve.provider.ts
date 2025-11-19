
import { DataSource } from 'typeorm';
import { ShelveEntity } from './shelve.entity';

export const shelveProvider = [
  {
    provide: 'SHELVE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ShelveEntity),
    inject: ['DATA_SOURCE'],
  },
];
