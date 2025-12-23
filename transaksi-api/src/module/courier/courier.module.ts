import { Module } from '@nestjs/common';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { courierProviders } from '../../common/entities/courier/courier.provider';
import { DatabaseModule } from '../../common/db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CourierController],
  providers: [CourierService, ...courierProviders],
})
export class CourierModule {}