import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';
// Import DTO yang baru dibuat
import { 
  CreateTransactionDto, 
  CreateGlobalDebtDto, 
  CreatePaymentDto 
} from './dto/create-journal.dto';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  // =========================================================================
  // TRANSAKSI UTAMA (SALE, BUY, RETURN)
  // =========================================================================

  @Post('sale')
  @ApiOperation({ summary: 'Create sale journal entry' })
  @ApiResponse({ status: 201, description: 'Sale journal created successfully' })
  async createSale(
    @Body() body: CreateTransactionDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    console.log(body);
    return this.journalService.createSale(body.details, userId, storeUuid);
  }

  @Post('buy')
  @ApiOperation({ summary: 'Create buy journal entry' })
  @ApiResponse({ status: 201, description: 'Buy journal created successfully' })
  async createBuy(
    @Body() body: CreateTransactionDto, // Gunakan DTO (strukturnya mirip Sale)
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createBuy(body.details, userId, storeUuid);
  }
  
  @Post('return/sale')
  @ApiOperation({ summary: 'Create sale return journal entry' })
  async createSaleReturn(
    @Body() body: CreateTransactionDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createSaleReturn(body.details, userId, storeUuid);
  }

  @Post('return/buy')
  @ApiOperation({ summary: 'Create buy return journal entry' })
  async createBuyReturn(
    @Body() body: CreateTransactionDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createBuyReturn(body.details, userId, storeUuid);
  }
  
  // =========================================================================
  // TRANSAKSI KEUANGAN / PIUTANG HUTANG GLOBAL
  // =========================================================================

  @Post('debt/ar')
  @ApiOperation({ summary: 'Create accounts receivable (Piutang) global entry' })
  async createAr(
    @Body() body: CreateGlobalDebtDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createAr(body.details, userId, storeUuid);
  }
  
  @Post('debt/ap')
  @ApiOperation({ summary: 'Create accounts payable (Hutang) global entry' })
  async createAp(
    @Body() body: CreateGlobalDebtDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createAp(body.details, userId, storeUuid);
  }

  @Post('payment/ar')
  @ApiOperation({ summary: 'Create accounts receivable payment journal entry' })
  async createArPayment(
    @Body() body: CreatePaymentDto, // Gunakan DTO Khusus Payment
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createArPayment(body.details, userId, storeUuid);
  }
  
  @Post('payment/ap')
  @ApiOperation({ summary: 'Create accounts payable payment journal entry' })
  async createApPayment(
    @Body() body: CreatePaymentDto,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.createApPayment(body.details, userId, storeUuid);
  }
  
  // =========================================================================
  // LAPORAN & GRAFIK (Tidak berubah karena GET)
  // =========================================================================

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