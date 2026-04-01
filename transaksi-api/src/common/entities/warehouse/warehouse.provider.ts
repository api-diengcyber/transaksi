

import { DataSource } from 'typeorm';
import { WarehouseEntity } from './warehouse.entity';

export const warehouseProvider = [
    {
        provide: 'WAREHOUSE_REPOSITORY',
        useFactory: (dataSource: DataSource) => dataSource.getRepository(WarehouseEntity),
        inject: ['DATA_SOURCE'],
    },
];
