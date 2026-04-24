import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException, Req, Put, Delete } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { JournalSaleService } from './journal-sale.service';
import { JournalStokService } from './journal-stok.service';
import { JournalBuyService } from './journal-buy.service';
import { JournalArService } from './journal-ar.service'; 
import { JournalApService } from './journal-ap.service';
import { JournalReturnSaleService } from './journal-return-sale.service';
import { JournalReturnBuyService } from './journal-return-buy.service';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

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
    private readonly journalApService: JournalApService,
    private readonly journalReturnSaleService: JournalReturnSaleService,
    private readonly journalReturnBuyService: JournalReturnBuyService,
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
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalArService.createAr(body.details, userId, storeUuid);
  }

  @Post('ar/payment')
  @ApiOperation({ summary: 'Process payment for Account Receivable (Pelunasan Piutang)' })
  async createArPaymentTransaction(
    @Body() body: any,
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalApService.createAp(body.details, userId, storeUuid);
  }

  @Post('ap/payment')
  @ApiOperation({ summary: 'Process payment for Account Payable (Pelunasan Hutang)' })
  async createApPaymentTransaction(
    @Body() body: any,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalApService.payAp(body.details, userId, storeUuid);
  }

  @Post('return-sale')
  @ApiOperation({ summary: 'Create return sale journal entry' })
  async createReturnSale(
    @Body() body: any,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalReturnSaleService.createReturnSale(body.details, userId, storeUuid);
  }

  @Post('return-buy')
  @ApiOperation({ summary: 'Create return buy journal entry' })
  async createReturnBuy(
    @Body() body: any,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalReturnBuyService.createReturnBuy(body.details, userId, storeUuid);
  }

  // =========================================================================
  // LAPORAN & HISTORI (ROUTING DINAMIS KE MASING-MASING SERVICE)
  // =========================================================================

  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE, BUY, AP, AR)' })
  async getReport(
    @Param('type') type: string,
    @GetStore() storeUuid: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,    
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('generalType') generalType?: string,
  ) {
    const normalizedType = type.toUpperCase();
    switch (normalizedType) {
      case 'ALL':
        return this.journalService.findAll(storeUuid, { type: generalType, page, limit, search, startDate, endDate });
      case 'SALE':
        return this.journalSaleService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      case 'BUY':
        return this.journalBuyService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      case 'RET_SALE': 
        return this.journalReturnSaleService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      case 'RET_BUY': 
        return this.journalReturnBuyService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      case 'AR':
        return this.journalArService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      case 'AP':
        return this.journalApService.getReport(storeUuid, { page, limit, search, startDate, endDate });
      default:
        throw new BadRequestException(`Tipe report '${normalizedType}' tidak valid atau belum diimplementasikan.`);
    }
  }

  @Get('report-inventory')
  async getInventoryReport(
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    return await this.journalStokService.getInventoryReport(storeUuid, start, end);
  }

  @Get('report-inventory/chart')
  async getInventoryChart(
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.journalStokService.getStockMovementChart(storeUuid, startDate, endDate);
  }

  // =========================================================================
  // CHART & HISTORI GUDANG
  // =========================================================================
  
  @Get('chart-data')
  async getChartData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @GetStore() storeUuid: string,
  ) {
    if (!startDate || !endDate) return [];
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
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalStokService.createManualMutation(body, userId, storeUuid);
  }

  /**
   * Endpoint untuk memecah stok (Konversi antar produk)
   * URL: POST /journal/break-stock
   */
  @Post('break-stock')
  @ApiOperation({ summary: 'Manual stock mutation (IN/OUT)' })
  async breakStock(
    @Body() payload: any,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return await this.journalStokService.breakStock(payload, userId, storeUuid);
  }

  @Post('combine-stock')
  async combineStock(
    @Body() payload: any, 
    @GetUser('sub') userId: string, 
    @GetStore() storeUuid: string,
  ) {
    return await this.journalStokService.combineStock(payload, userId, storeUuid);
  }

  @Get('one/:uuid')
  async getJournalByUuid(@Param('uuid') uuid: string) {
    return await this.journalService.getJournalByUuid(uuid);
  }

  @Post('opname/draft')
  @ApiOperation({ summary: 'Membuat Draft Stok Opname (Stok Belum Berubah)' })
  async createOpnameDraft(
    @Body() payload: any, // Pastikan di-mapping ke DTO CreateOpnameDraftDto jika Anda menggunakan validasi ketat
    @GetStore() storeUuid: string
  ) {
    return await this.journalStokService.createOpnameDraft(payload, storeUuid);
  }

  @Get('opname/unverified/:warehouseUuid')
  @ApiOperation({ summary: 'Mendapatkan Daftar Dokumen Opname yang Menunggu Verifikasi' })
  async getUnverifiedOpnames(
    @Param('warehouseUuid') warehouseUuid: string, 
    @GetStore() storeUuid: string
  ) {
    return await this.journalStokService.getUnverifiedOpnames(warehouseUuid, storeUuid);
  }

  @Put('opname/verify/:uuid')
  @ApiOperation({ summary: 'Memverifikasi Opname & Menyesuaikan Stok Secara Otomatis' })
  async verifyOpname(
    @Param('uuid') journalUuid: string, 
    @GetUser('sub') adminUuid: string // Menangkap UUID Admin/SPV yang melakukan klik dari Token JWT
  ) {
    return await this.journalStokService.verifyOpnameJournal(journalUuid, adminUuid);
  }

  // ===========================================================================
  // ENDPOINT MUTASI MANUAL (JIKA BELUM ADA)
  // ===========================================================================

  @Post('mutation')
  @ApiOperation({ summary: 'Membuat Mutasi Stok Manual (Masuk / Keluar)' })
  async createManualMutation(
    @Body() payload: any,
    @GetUser('sub') userUuid: string, // Bisa diambil dari token, atau dari payload frontend
    @GetStore() storeUuid: string
  ) {
    // Memanggil _executeStockJournal via stockIn / stockOut
    const { type, product_uuid, warehouse_uuid, shelve_uuid, qty, note, user_uuid } = payload;
    
    // Gunakan user_uuid dari frontend jika dikirim (PIC Mutasi), jika tidak gunakan user login
    const picUuid = user_uuid || userUuid; 

    const item = {
        productUuid: product_uuid,
        warehouseUuid: warehouse_uuid,
        shelveUuid: shelve_uuid,
        qty: Number(qty)
    };

    // Karena bukan draf, isDraft = false, isOpname = false
    if (type === 'IN') {
        await this.journalStokService.stockIn([item], picUuid, undefined, storeUuid, note, false, false);
        return { message: 'Mutasi masuk berhasil' };
    } else if (type === 'OUT') {
        await this.journalStokService.stockOut([item], picUuid, undefined, storeUuid, note, false, false);
        return { message: 'Mutasi keluar berhasil' };
    } else {
        throw new Error('Tipe mutasi tidak valid');
    }
  }

  @Get('sale/search/:code')
  async getSaleByCode(
    @Param('code') code: string, 
    @GetStore() storeUuid: string
  ) {
    return await this.journalSaleService.getSaleByCode(storeUuid, code);
  }

  @Get('buy/search/:code')
  async getBuyByCode(
    @Param('code') code: string, 
    @GetStore() storeUuid: string
  ) {
    return await this.journalBuyService.getBuyByCode(storeUuid, code);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Menghapus Jurnal Umum' })
  async deleteJournal(
    @Param('uuid') uuid: string,
    @GetUser('sub') userId: string,
  ) {
    return this.journalService.deleteJournal(uuid, userId);
  }
  
  @Get('template')
  async getTemplates(@GetStore() storeUuid: string) {
    return this.journalService.getTemplates(storeUuid);
  }

  @Post('manual')
  async createManual(
    @Body() dto: CreateManualJournalDto,
    @GetStore() storeUuid: string,
    @GetUser('uuid') userUuid: string,
  ) {
    return this.journalService.createManual(dto, storeUuid, userUuid);
  }
}