
import { DataSource } from 'typeorm';
import { UnitEntity } from './unit.entity';

export const unitProvider = [
  {
    provide: 'UNIT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(UnitEntity),
    inject: ['DATA_SOURCE'],
  },
];
