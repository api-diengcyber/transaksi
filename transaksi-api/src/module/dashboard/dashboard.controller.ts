import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AtGuard } from 'src/common/guards/at.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth()
@UseGuards(AtGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dapatkan ringkasan data dashboard' })
  async getSummary(@Query('storeUuid') storeUuid: string) {
    return await this.dashboardService.getSummary(storeUuid);
  }
}