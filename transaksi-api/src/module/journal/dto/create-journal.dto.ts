import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsBooleanString, 
  IsDateString 
} from 'class-validator';

// =============================================================================
// BASE DETAILS (Field yang mungkin ada di dynamic object)
// =============================================================================
class BaseJournalDetailsDto {
    // Mengizinkan properti dinamis seperti 'product_uuid#0', 'qty#0'
    [key: string]: any;
}

// =============================================================================
// 1. DTO UNTUK TRANSAKSI UTAMA (SALE / BUY / RETURN)
// =============================================================================

export class TransactionDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Total keseluruhan transaksi', example: 150000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiProperty({ description: 'Grand total (biasanya sama dengan amount)', example: 150000 })
  @IsOptional()
  grand_total?: number | string;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'CASH' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Apakah transaksi kredit?', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  is_credit?: string;

  @ApiPropertyOptional({ description: 'Tanggal jatuh tempo (jika kredit)', example: '2025-12-30' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Nama Customer (untuk Sale)', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Nama Supplier (untuk Buy)', example: 'PT. Maju Jaya' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Target Store UUID untuk mirroring', example: 'store-uuid-xxx' })
  @IsOptional()
  @IsUUID()
  target_store_uuid?: string;
}

export class CreateTransactionDto {
  @ApiProperty({ type: TransactionDetailsDto })
  @IsNotEmpty()
  @Type(() => TransactionDetailsDto)
  details: TransactionDetailsDto;
}

// =============================================================================
// 2. DTO UNTUK PIUTANG/HUTANG GLOBAL (AR / AP)
// =============================================================================

export class GlobalDebtDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Nominal Piutang/Hutang', example: 500000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiPropertyOptional({ description: 'Nama Customer', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Nama Supplier', example: 'PT. Sumber Rejeki' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Tanggal jatuh tempo', example: '2025-01-20' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Catatan tambahan', example: 'Saldo Awal' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGlobalDebtDto {
  @ApiProperty({ type: GlobalDebtDetailsDto })
  @IsNotEmpty()
  @Type(() => GlobalDebtDetailsDto)
  details: GlobalDebtDetailsDto;
}

// =============================================================================
// 3. DTO UNTUK PEMBAYARAN (PAYMENT AR / AP)
// =============================================================================

export class PaymentDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Nominal yang dibayar', example: 100000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiProperty({ description: 'Kode Jurnal Referensi yang dibayar', example: 'SALE-XXX-2025-0001' })
  @IsNotEmpty()
  @IsString()
  reference_journal_code: string;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'TRANSFER' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Nama Customer', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Nama Supplier', example: 'PT. Sumber Rejeki' })
  @IsOptional()
  @IsString()
  supplier?: string;
}

export class CreatePaymentDto {
  @ApiProperty({ type: PaymentDetailsDto })
  @IsNotEmpty()
  @Type(() => PaymentDetailsDto)
  details: PaymentDetailsDto;
}