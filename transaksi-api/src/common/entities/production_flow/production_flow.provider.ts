

import { DataSource } from 'typeorm';
import { ProductionFlowEntity } from './production_flow.entity';

export const productionFlowProvider = [
    {
        provide: 'PRODUCTION_FLOW_REPOSITORY',
        useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductionFlowEntity),
        inject: ['DATA_SOURCE'],
    },
];
