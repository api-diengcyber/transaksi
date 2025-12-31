import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { TableService } from './table.service'; 
import { CreateTableDto, UpdateTableDto } from './dto/create-table.dto';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { BookTableDto } from './dto/update-status.dto';

@ApiTags('Restaurant Table (Meja)')
@ApiBearerAuth() 
@UseGuards(AtGuard) 
@Controller('table')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create new restaurant table' })
  async create(
    @Body() body: CreateTableDto,
    @GetUser('sub') userId: string, 
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.create(body, userId, storeUuid); 
  }

  @Get('find-all')
  @ApiOperation({ summary: 'Get all restaurant tables' })
  async findAll(
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.findAll(storeUuid);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get table detail' })
  async findOne(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.findOne(uuid, storeUuid);
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update table data' })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: UpdateTableDto,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.update(uuid, body, userId, storeUuid); 
  }

  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Soft delete table' })
  async remove(
    @Param('uuid') uuid: string,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.remove(uuid, userId, storeUuid); 
  }

  @Post('restore/:uuid')
  @ApiOperation({ summary: 'Restore deleted table' })
  async restore(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.tableService.restore(uuid, storeUuid);
  }

  // [BARU] Endpoint Booking
  @Post('book/:uuid')
  @ApiOperation({ summary: 'Book a table' })
  async bookTable(
    @Param('uuid') uuid: string,
    @Body() body: BookTableDto,
    @GetStore() storeUuid: string,
    @GetUser('sub') userId: string,
  ) {
    return this.tableService.bookTable(uuid, body, storeUuid, userId);
  }

  // [BARU] Endpoint Occupied (Tamu Datang/Isi)
  @Post('occupy/:uuid')
  @ApiOperation({ summary: 'Mark table as occupied' })
  async occupyTable(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
    @GetUser('sub') userId: string,
  ) {
    return this.tableService.occupyTable(uuid, storeUuid, userId);
  }

  // [BARU] Endpoint Clear (Meja Selesai/Kosongkan)
  @Post('clear/:uuid')
  @ApiOperation({ summary: 'Mark table as available/cleared' })
  async clearTable(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
    @GetUser('sub') userId: string,
  ) {
    return this.tableService.clearTable(uuid, storeUuid, userId);
  }
}