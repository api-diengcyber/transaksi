import { Module } from '@nestjs/common';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { courierProviders } from '../../common/entities/courier/courier.provider';
import { DatabaseModule } from '../../common/db/database.module';
import { courierRouteProviders } from 'src/common/entities/courier_routes/courier_route.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [CourierController],
  providers: [
    CourierService,
    ...courierProviders,
    ...courierRouteProviders
  ],
})
export class CourierModule { }