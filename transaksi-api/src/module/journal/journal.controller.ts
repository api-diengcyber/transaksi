import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(AtGuard)
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
  async createSale(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createSale(body.details, body.userId, storeUuid);
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
  async createBuy(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createBuy(body.details, body.userId, storeUuid);
  }
  
  // [BARU] Endpoint untuk Retur Penjualan
  @Post('return/sale')
  @ApiOperation({ summary: 'Create sale return journal entry' })
  async createSaleReturn(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createSaleReturn(body.details, body.userId, storeUuid);
  }

  // [BARU] Endpoint untuk Retur Pembelian
  @Post('return/buy')
  @ApiOperation({ summary: 'Create buy return journal entry' })
  async createBuyReturn(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createBuyReturn(body.details, body.userId, storeUuid);
  }
  
  // [BARU] Endpoint untuk Piutang Global (AR)
  @Post('debt/ar')
  @ApiOperation({ summary: 'Create accounts receivable (Piutang) global entry' })
  async createAr(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createAr(body.details, body.userId, storeUuid);
  }
  
  // [BARU] Endpoint untuk Hutang Global (AP)
  @Post('debt/ap')
  @ApiOperation({ summary: 'Create accounts payable (Hutang) global entry' })
  async createAp(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createAp(body.details, body.userId, storeUuid);
  }

  // [BARU] Endpoint untuk Pembayaran Piutang
  @Post('payment/ar')
  @ApiOperation({ summary: 'Create accounts receivable payment journal entry' })
  async createArPayment(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createArPayment(body.details, body.userId, storeUuid);
  }
  
  // [BARU] Endpoint untuk Pembayaran Hutang
  @Post('payment/ap')
  @ApiOperation({ summary: 'Create accounts payable payment journal entry' })
  async createApPayment(
    @Body() body: any,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createApPayment(body.details, body.userId, storeUuid);
  }
  
  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE)' })
  async getReport(
    @Param('type') type: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.findAllByType(type, storeUuid);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Get chart data for Buy vs Sale' })
  async getChart(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @GetStore() storeUuid: string,
  ) {
    if (!startDate || !endDate) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return this.journalService.getChartData(start.toISOString(), end.toISOString(), storeUuid);
    }
    return this.journalService.getChartData(startDate, endDate, storeUuid);
  }
}