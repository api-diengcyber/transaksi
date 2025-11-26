

import { DataSource } from 'typeorm';
import { ProductionEntity } from './production.entity';

export const productionProvider = [
    {
        provide: 'PRODUCTION_REPOSITORY',
        useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductionEntity),
        inject: ['DATA_SOURCE'],
    },
];
