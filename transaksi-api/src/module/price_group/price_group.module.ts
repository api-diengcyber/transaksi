import { Module } from '@nestjs/common';
import { PriceGroupService } from './price_group.service';
import { PriceGroupController } from './price_group.controller';
import { DatabaseModule } from '../../common/db/database.module';
// Jangan lupa buat provider-nya (priceGroupProviders) yang mengekspos PRICE_GROUP_REPOSITORY
import { priceGroupProviders } from '../../common/entities/price_group/price_group.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [PriceGroupController],
  providers: [PriceGroupService, ...priceGroupProviders],
  exports: [PriceGroupService],
})
export class PriceGroupModule {}