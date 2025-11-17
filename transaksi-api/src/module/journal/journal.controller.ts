import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiBody, ApiTags } from '@nestjs/swagger';

@ApiTags('Journal')
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post('sale')
  @ApiOperation({ summary: 'Create sale journal entry' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        details: { type: 'object', example: { product: 'Apple', qty: 3 } },
        userId: { type: 'string', example: 'uuid-user-123' },
      },
      required: ['amount', 'details', 'userId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Sale journal created successfully' })
  async createSale(@Body() body: any) {
    return this.journalService.createSale(body.details, body.userId);
  }

  @Post('buy')
  @ApiOperation({ summary: 'Create buy journal entry' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        details: { type: 'object', example: { supplier: 'XYZ', invoice: 'INV-0012' } },
        userId: { type: 'string', example: 'uuid-user-123' },
      },
      required: ['amount', 'details', 'userId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Buy journal created successfully' })
  async createBuy(@Body() body: any) {
    return this.journalService.createBuy(body.details, body.userId);
  }
  
  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE)' })
  async getReport(@Param('type') type: string) {
    return this.journalService.findAllByType(type);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get chart data for Buy vs Sale' })
  async getChart(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return this.journalService.getChartData(start.toISOString(), end.toISOString());
    }
    return this.journalService.getChartData(startDate, endDate);
  }
}
