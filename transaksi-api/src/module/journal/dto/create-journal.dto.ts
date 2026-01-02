import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString 
} from 'class-validator';

// =============================================================================
// BASE DETAILS
// =============================================================================
class BaseJournalDetailsDto {
    [key: string]: any;
}

// =============================================================================
// ITEM DTO (Untuk menangkap detail item)
// =============================================================================
export class JournalItemDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    product_uuid: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    unit_uuid: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    qty: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    price: number;

    // Menangkap field lain seperti name, discount, notes, selectedPriceObj, dll
    [key: string]: any;
}

// =============================================================================
// 1. DTO TRANSACTION (SALE / BUY / RETURN)
// =============================================================================
export class TransactionDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty({ description: 'Total keseluruhan transaksi', example: 150000 })
  @IsNotEmpty()
  amount: number | string;

  @ApiPropertyOptional({ description: 'Grand total', example: 150000 })
  @IsOptional()
  grand_total?: number | string;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'CASH' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Is Credit', example: true })
  @IsOptional()
  is_credit?: string | boolean;

  @ApiPropertyOptional({ description: 'Jatuh Tempo', example: '2025-12-30' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ description: 'Customer Name', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Supplier Name', example: 'PT. Maju' })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({ description: 'Target Store UUID' })
  @IsOptional()
  @IsUUID()
  target_store_uuid?: string;

  // [BARU] Array Items untuk detail lengkap
  @ApiPropertyOptional({ type: [JournalItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalItemDto)
  items?: JournalItemDto[];
}

export class CreateTransactionDto {
  @ApiProperty({ type: TransactionDetailsDto })
  @IsNotEmpty()
  @Type(() => TransactionDetailsDto)
  details: TransactionDetailsDto;
}

// (Sisa DTO GlobalDebtDetailsDto & CreateGlobalDebtDto & CreatePaymentDto tetap sama seperti file asli)
export class GlobalDebtDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty() @IsNotEmpty() amount: number | string;
  @ApiPropertyOptional() @IsOptional() @IsString() customer_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class CreateGlobalDebtDto {
  @ApiProperty({ type: GlobalDebtDetailsDto }) @IsNotEmpty() @Type(() => GlobalDebtDetailsDto) details: GlobalDebtDetailsDto;
}
export class PaymentDetailsDto extends BaseJournalDetailsDto {
  @ApiProperty() @IsNotEmpty() amount: number | string;
  @ApiProperty() @IsNotEmpty() @IsString() reference_journal_code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() payment_method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customer_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
}
export class CreatePaymentDto {
  @ApiProperty({ type: PaymentDetailsDto }) @IsNotEmpty() @Type(() => PaymentDetailsDto) details: PaymentDetailsDto;
}