import { Controller, Get } from '@nestjs/common';
import { PriceGroupService } from './price_group.service';
import { GetStore } from '../../common/decorators/get-store.decorator';

@Controller('price-group')
export class PriceGroupController {
  constructor(private readonly service: PriceGroupService) {}

  @Get('find-all')
  findAll(@GetStore() storeUuid: string) {
    return this.service.findAll(storeUuid);
  }
}