import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Unit (Satuan)')
@Controller('unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post('create')
  @ApiOperation({ summary: 'Membuat satuan baru' })
  create(
        @Body() createUnitDto: CreateUnitDto, 
        @GetStore() storeUuid: string,
        @GetUser('sub') userId: string
    ) {
    return this.unitService.create(createUnitDto, storeUuid, userId);
  }

  @Get('find-all')
  @ApiOperation({ summary: 'Mengambil semua data satuan' })
  findAll() {
    return this.unitService.findAll();
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Mengambil detail satuan berdasarkan UUID' })
  findOne(@Param('uuid') uuid: string) {
    return this.unitService.findOne(uuid);
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Mengubah data satuan' })
  update(
    @Param('uuid') uuid: string, 
    @Body() updateUnitDto: UpdateUnitDto,
    @GetUser('sub') userId: string
  ) {
    return this.unitService.update(uuid, updateUnitDto, userId);
  }

  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Menghapus data satuan' })
  remove(@Param('uuid') uuid: string, @GetUser('sub') userId: string) {
    return this.unitService.remove(uuid, userId);
  }
}