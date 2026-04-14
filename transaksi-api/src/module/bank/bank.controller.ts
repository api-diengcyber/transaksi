import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BankService } from './bank.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto'; 
import { AtGuard } from '../../common/guards/at.guard';
import { GetStore } from '../../common/decorators/get-store.decorator';

@Controller('bank')
@UseGuards(AtGuard)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('/get-all')
  findAll(@GetStore() storeUuid: string) {
    return this.bankService.findAll(storeUuid);
  }

  @Post('/create')
  create(@Body() dto: CreateBankDto, @GetStore() storeUuid: string) {
    return this.bankService.create(dto, storeUuid);
  }

  @Put('/update/:id')
  update(
    @Param('id') id: string, 
    @Body() dto: UpdateBankDto, 
    @GetStore() storeUuid: string
  ) {
    return this.bankService.update(id, dto, storeUuid);
  }

  @Delete('/remove/:id')
  delete(@Param('id') id: string, @GetStore() storeUuid: string) {
    return this.bankService.delete(id, storeUuid); // Pass storeUuid untuk keamanan
  }
}