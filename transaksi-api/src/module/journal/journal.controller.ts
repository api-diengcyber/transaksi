import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { JournalSaleService } from './journal-sale.service';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('journal')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    private readonly journalSaleService: JournalSaleService,
  ) {}

  // =========================================================================
  // TRANSAKSI UMUM (SALE)
  // =========================================================================

  @Post('sale')
  @ApiOperation({ summary: 'Create sale journal entry' })
  @ApiBody({ schema: { example: { details: { items: [], grand_total: 10000, any_other_field: "value" } } } })
  @ApiResponse({ status: 201, description: 'Sale journal created successfully' })
  async createSale(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalSaleService.createSale(body.details, userId, storeUuid);
  }

  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE)' })
  async getReport(
    @Param('type') type: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.findAllByType(type, storeUuid);
  }
  
  // [TAMBAHKAN ENDPOINT INI]
  @Get('chart-data')
  async getChartData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @GetStore() storeUuid: string,
  ) {
    if (!startDate || !endDate) {
      return [];
    }
    return this.journalService.getChartData(startDate, endDate, storeUuid);
  }
}