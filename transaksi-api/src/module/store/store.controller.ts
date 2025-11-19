import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { StoreService } from './store.service';
import { InstallStoreDto } from './dto/install-store.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post('install')
  @ApiOperation({ summary: 'Install store and create admin user (Public)' })
  async installStore(@Body() dto: InstallStoreDto) {
    return this.storeService.installStore(dto);
  }

  @Get('my-store')
  @UseGuards(AtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of user stores with active status based on Token' })
  async getMyStores(
    @GetUser('sub') userId: string,
    @GetUser('storeUuid') activeStoreUuid: string
  ) {
    return this.storeService.getMyStores(userId, activeStoreUuid);
  }
}