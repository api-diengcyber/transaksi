import { Injectable, Inject } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { StoreEntity } from 'src/common/entities/store/store.entity';
import { StoreSettingEntity } from 'src/common/entities/store_setting/store_setting.entity';

@Injectable()
export class StoreService {
  constructor(
    @Inject('STORE_REPOSITORY')
    private storeRepository: Repository<StoreEntity>,
    @Inject('STORE_SETTING_REPOSITORY')
    private storeSettingRepository: Repository<StoreSettingEntity>,
    @Inject('DATA_SOURCE')
    private dataSource: DataSource,
  ) {}
}