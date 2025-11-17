
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { storeProvider } from 'src/common/entities/store/store.provider';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { storeSettingProvider } from 'src/common/entities/store_setting/store_setting.provider';

@Module({
  imports: [
    DatabaseModule
  ],
  controllers: [StoreController],
  providers: [
    ...storeProvider,
    ...storeSettingProvider,
    StoreService,
  ],
})
export class StoreModule {}
