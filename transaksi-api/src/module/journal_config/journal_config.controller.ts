import { Controller, Get, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { JournalConfigService } from './journal_config.service';
import { CreateJournalConfigDto } from './dto/create-journal-config.dto';

@ApiTags('Journal Config')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('journal-config')
export class JournalConfigController {
  constructor(private readonly service: JournalConfigService) {}

  @Get('discovery')
  getDiscovery(@GetStore() storeUuid: string) {
    return this.service.getDiscovery(storeUuid);
  }
  
  @Get()
  findAll(@GetStore() storeUuid: string) {
    return this.service.findAll(storeUuid);
  }

  @Post()
  create(
    @Body() dto: CreateJournalConfigDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.service.create(dto, userId, storeUuid);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @GetUser('uuid') userId: string,
  ) {
    return this.service.remove(uuid, userId);
  }
}