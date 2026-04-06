import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BrandService } from './brand.service';
import { AtGuard } from '../../common/guards/at.guard';
import { GetStore } from '../../common/decorators/get-store.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@Controller('brand')
@UseGuards(AtGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  create(
    @Body() createBrandDto: any, 
    @GetUser('uuid') userId: string, 
    @GetStore() storeUuid: string,
    ) {
    return this.brandService.create(createBrandDto, storeUuid);
  }

  @Get()
  findAll(
      @GetUser('uuid') userId: string, 
      @GetStore() storeUuid: string,
    ) {
    return this.brandService.findAll(storeUuid);
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @Body() updateBrandDto: any) {
    return this.brandService.update(uuid, updateBrandDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.brandService.remove(uuid);
  }
}