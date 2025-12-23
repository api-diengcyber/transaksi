import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsBooleanString, 
  IsDateString 
} from 'class-validator';

// =============================================================================
// BASE DETAILS
// =============================================================================
class BaseJournalDetailsDto {
    [key: string]: any; // Allow dynamic keys (product_uuid#0, etc)
}

// =============================================================================
// 1. DTO TRANSACTION (SALE / BUY / RETURN)
// =============================================================================
export class TransactionDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Total keseluruhan transaksi', example: 150000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiPropertyOptional({ description: 'Grand total (jika berbeda)', example: 150000 })
  @IsOptional()
  grand_total?: number | string;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'CASH' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  // [PERBAIKAN] Gunakan IsOptional saja agar bisa terima boolean asli atau string boolean
  @ApiPropertyOptional({ description: 'Apakah transaksi kredit?', example: 'true' })
  @IsOptional()
  is_credit?: string | boolean;

  @ApiPropertyOptional({ description: 'Tanggal jatuh tempo', example: '2025-12-30' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Nama Customer', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Nama Supplier', example: 'PT. Maju Jaya' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Target Store UUID', example: 'store-uuid-xxx' })
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
// 2. DTO PIUTANG/HUTANG GLOBAL (AR / AP)
// =============================================================================
export class GlobalDebtDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Nominal', example: 500000 })
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

  @ApiPropertyOptional({ description: 'Catatan', example: 'Saldo Awal' })
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
// 3. DTO PEMBAYARAN (PAYMENT)
// =============================================================================
export class PaymentDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Nominal yang dibayar', example: 100000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiProperty({ description: 'Kode Referensi', example: 'SALE-XXX-2025-0001' })
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