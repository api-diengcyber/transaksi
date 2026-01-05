import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JournalService } from './journal.service';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Journal')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  // =========================================================================
  // TRANSAKSI UMUM (SALE)
  // =========================================================================

  @Post('sale')
  @ApiOperation({ summary: 'Create sale journal entry' })
  // Contoh payload fleksibel
  @ApiBody({ schema: { example: { details: { items: [], grand_total: 10000, any_other_field: "value" } } } })
  @ApiResponse({ status: 201, description: 'Sale journal created successfully' })
  async createSale(
    @Body() body: any,
    @GetUser('uuid') userId: string,
    @GetStore() storeUuid: string,
  ) {
    // Terima apapun yang dikirim frontend dalam object 'details'
    return this.journalService.createSale(body.details, userId, storeUuid);
  }

  @Get('report/:type')
  @ApiOperation({ summary: 'Get journal report by type (e.g., SALE)' })
  async getReport(
    @Param('type') type: string,
    @GetStore() storeUuid: string,
  ) {
    return this.journalService.findAllByType(type, storeUuid);
  }
}