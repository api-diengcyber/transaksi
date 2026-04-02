// warehouse.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { WarehouseService } from './warehouse.service';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { JournalStokService } from '../journal/journal-stok.service';

@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly journalStokService: JournalStokService,
  ) {}

  @Post('create')
  create(
        @Body() dto: CreateWarehouseDto, 
        @GetUser('uuid') userId: string,
        @GetStore() storeUuid: string,
    ) {
    return this.warehouseService.create(dto, storeUuid, userId);
  }

  @Get('find-all')
  findAll() {
    return this.warehouseService.findAll();
  }

  @Get(':uuid/stock')
  async getWarehouseStock(@Param('uuid') uuid: string, @GetStore() storeUuid: string) {
    return await this.journalStokService.getWarehouseStock(uuid, storeUuid);
  }
}