import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { JournalSaleService } from './journal-sale.service';
import { JournalStokService } from './journal-stok.service';
import { JournalBuyService } from './journal-buy.service';
import { JournalArService } from './journal-ar.service'; 
import { JournalApService } from './journal-ap.service'; // <-- IMPORT AP SERVICE

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('journal')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    private readonly journalSaleService: JournalSaleService,
    private readonly journalBuyService: JournalBuyService,
    private readonly journalStokService: JournalStokService,
    private readonly journalArService: JournalArService, 
    private readonly journalApService: JournalApService, // <-- INJECT AP SERVICE
  ) {}

  // =========================================================================
  // TRANSAKSI UMUM (SALE / BUY)
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

  @Post('buy')
  @ApiOperation({ summary: 'Create buy journal entry' })
  @ApiBody({ schema: { example: { details: { items: [], grand_total: 10000, any_other_field: "value" } } } })
  @ApiResponse({ status: 201, description: 'Buy journal created successfully' })
  async createBuy(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalBuyService.createBuy(body.details, userId, storeUuid);
  }

  // =========================================================================
  // PIUTANG (AR - ACCOUNTS RECEIVABLE)
  // =========================================================================

  @Post('ar')
  @ApiOperation({ summary: 'Create manual Account Receivable (Piutang) journal' })
  async createArTransaction(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalArService.createAr(body.details, userId, storeUuid);
  }

  @Post('ar/payment')
  @ApiOperation({ summary: 'Process payment for Account Receivable (Pelunasan Piutang)' })
  async createArPaymentTransaction(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalArService.payAr(body.details, userId, storeUuid);
  }

  // =========================================================================
  // HUTANG (AP - ACCOUNTS PAYABLE)
  // =========================================================================

  @Post('ap')
  @ApiOperation({ summary: 'Create manual Account Payable (Hutang) journal' })
  async createApTransaction(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalApService.createAp(body.details, userId, storeUuid);
  }

  @Post('ap/payment')
  @ApiOperation({ summary: 'Process payment for Account Payable (Pelunasan Hutang)' })
  async createApPaymentTransaction(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalApService.payAp(body.details, userId, storeUuid);
  }

  // =========================================================================
  // LAPORAN & HISTORI
  // =========================================================================

  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE)' })
  async getReport(
    @Param('type') type: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.findAllByType(type, storeUuid);
  }
  
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
  
  @Get('warehouse/:warehouseUuid/history')
  @ApiOperation({ summary: 'Get history of stock mutation in a warehouse' })
  async getWarehouseHistory(
    @Param('warehouseUuid') warehouseUuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalStokService.getWarehouseHistory(warehouseUuid, storeUuid);
  }
  
  // =========================================================================
  // ENDPOINT MUTASI STOK MANUAL
  // =========================================================================
  @Post('stock-mutation')
  @ApiOperation({ summary: 'Manual stock mutation (IN/OUT)' })
  async createStockMutation(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalStokService.createManualMutation(body, userId, storeUuid);
  }
}