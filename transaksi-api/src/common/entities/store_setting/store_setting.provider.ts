
import { DataSource } from 'typeorm';
import { StoreSettingEntity } from './store_setting.entity';

export const storeSettingProvider = [
  {
    provide: 'STORE_SETTING_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(StoreSettingEntity),
    inject: ['DATA_SOURCE'],
  },
];
