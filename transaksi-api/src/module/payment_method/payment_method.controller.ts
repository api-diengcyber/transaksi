// src/module/payment_method/payment_method.controller.ts
import { Controller, Get, Put, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetStore } from 'src/common/decorators/get-store.decorator'; // Pastikan path ini benar sesuai struktur Anda

@Controller('payment-methods')
@UseGuards(AtGuard)
export class PaymentMethodController {
  constructor(private readonly service: PaymentMethodService) {}

  @Get()
  findAll(
    @GetStore() storeUuid: string
  ) {
    return this.service.findAllByStore(storeUuid);
  }

  @Put(':uuid')
  update(
    @Param('uuid') uuid: string, 
    @Body() data: any,
    @GetStore() storeUuid: string
  ) {
    return this.service.update(uuid, data, storeUuid);
  }

  @Patch(':uuid/status')
  toggle(
    @Param('uuid') uuid: string, 
    @Body('is_active') isActive: boolean,
    @GetStore() storeUuid: string
  ) {
    return this.service.toggleStatus(uuid, isActive, storeUuid);
  }
}