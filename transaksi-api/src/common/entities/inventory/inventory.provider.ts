
import { DataSource } from 'typeorm';
import { InventoryEntity } from './inventory.entity';

export const inventoryProvider = [
  {
    provide: 'INVENTORY_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(InventoryEntity),
    inject: ['DATA_SOURCE'],
  },
];
