
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { storeProvider } from 'src/common/entities/store/store.provider';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { storeSettingProvider } from 'src/common/entities/store_setting/store_setting.provider';
import { AuthModule } from '../auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import { CategoryModule } from '../category/category.module';
import { userProvider } from 'src/common/entities/user/user.provider';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CategoryModule,
    MulterModule.register({
      dest: './uploads', 
    }),
  ],
  controllers: [StoreController],
  providers: [
    ...storeProvider,
    ...storeSettingProvider,
    ...userProvider,
    StoreService,
  ],
})
export class StoreModule {}
