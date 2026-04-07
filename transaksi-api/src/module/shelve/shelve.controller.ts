// shelve.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ShelveService } from './shelve.service';
import { CreateShelveDto } from './dto/create-shelve.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@Controller('shelve')
export class ShelveController {
  constructor(private readonly service: ShelveService) {}

  @Post('create')
  create(
        @Body() dto: CreateShelveDto, 
        @GetUser('sub') userId: string,
        @GetStore() storeUuid: string,
    ) {
    return this.service.create(dto, storeUuid, userId);
  }

  @Get('find-all')
  findAll() {
    return this.service.findAll();
  }
}
