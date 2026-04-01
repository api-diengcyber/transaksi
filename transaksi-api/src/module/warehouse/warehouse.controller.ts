// warehouse.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { WarehouseService } from './warehouse.service';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly service: WarehouseService) {}

  @Post('create')
  create(
        @Body() dto: CreateWarehouseDto, 
        @GetUser('uuid') userId: string,
        @GetStore() storeUuid: string,
    ) {
    return this.service.create(dto, storeUuid, userId);
  }

  @Get('find-all')
  findAll() {
    return this.service.findAll();
  }
}