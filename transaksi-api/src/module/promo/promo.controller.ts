// promo.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AtGuard } from '../../common/guards/at.guard';
import { PromoService } from './promo.service';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@UseGuards(AtGuard)
@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post()
  create(
    @Body() createPromoDto: any,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
	) {
    return this.promoService.create(createPromoDto, storeUuid);
  }

  @Get()
  findAll(
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
	) {
    return this.promoService.findAll(storeUuid);
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.promoService.findOne(uuid);
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @Body() updatePromoDto: any) {
    return this.promoService.update(uuid, updatePromoDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.promoService.remove(uuid);
  }
}