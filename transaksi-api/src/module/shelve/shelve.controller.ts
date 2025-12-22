import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { ShelveService } from './shelve.service';
import { CreateShelveDto, UpdateShelveDto } from './dto/create-shelve.dto';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Product Shelve (Rak)')
@ApiBearerAuth() 
@UseGuards(AtGuard) 
@Controller('shelve')
export class ShelveController {
  constructor(private readonly shelveService: ShelveService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create new shelf' })
  async create(
    @Body() body: CreateShelveDto,
    @GetUser('sub') userId: string, 
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.create(body, userId, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  @Get('find-all')
  @ApiOperation({ summary: 'Get all shelves' })
  async findAll(
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.findAll(storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get shelf detail' })
  async findOne(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.findOne(uuid, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update shelf data' })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: UpdateShelveDto,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.update(uuid, body, userId, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Soft delete shelf' })
  async remove(
    @Param('uuid') uuid: string,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.remove(uuid, userId, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  @Post('restore/:uuid')
  @ApiOperation({ summary: 'Restore deleted shelf' })
  async restore(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.shelveService.restore(uuid, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }
}