
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { productShelveProvider } from 'src/common/entities/product_shelve/product_shelve.provider';
import { shelveProvider } from 'src/common/entities/shelve/shelve.provider';
import { ShelveController } from './shelve.controller';
import { ShelveService } from './shelve.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ShelveController],
  providers: [
    ...shelveProvider,
    ...productShelveProvider,
    ShelveService,
  ],
  exports: [ShelveService],
})
export class ShelveModule {}
