import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BankService } from './bank.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { AtGuard } from '../../common/guards/at.guard';
import { GetStore } from '../../common/decorators/get-store.decorator';

@Controller('bank')
@UseGuards(AtGuard)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get()
  findAll(@GetStore() storeId: string) {
    return this.bankService.findAll(storeId);
  }

  @Post()
  create(@Body() dto: CreateBankDto, @GetStore() storeId: string) {
    return this.bankService.create(dto, storeId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.bankService.delete(id);
  }
}