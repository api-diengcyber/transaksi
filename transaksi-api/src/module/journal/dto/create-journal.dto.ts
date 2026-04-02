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
    // Memastikan DTO tetap bisa menerima payload dinamis (seperti amount_bank_xxx)
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

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    variant_uuid?: string;

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

    // Menangkap field dinamis dari cart (subtotal, stok_qty_min, item_name, dll)
    [key: string]: any;
}

// =============================================================================
// 1. DTO TRANSACTION (SALE / BUY / RETURN)
// =============================================================================
export class TransactionDetailsDto extends BaseJournalDetailsDto {
  
  // amount diubah menjadi Opsional karena frontend mengirimkan grand_total
  @ApiPropertyOptional({ description: 'Total keseluruhan transaksi', example: 150000 })
  @IsOptional()
  amount?: number | string;

  @ApiPropertyOptional({ description: 'Grand total', example: 150000 })
  @IsOptional()
  grand_total?: number | string;

  @ApiPropertyOptional({ description: 'Total item/kuantitas' })
  @IsOptional()
  @IsNumber()
  total_items?: number;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'MIXED' })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Status (PENDING/COMPLETED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Jatuh Tempo (Kredit)', example: '2025-12-30' })
  @IsOptional()
  due_date?: string | Date;

  @ApiPropertyOptional({ description: 'Catatan Kasir' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Customer Name', example: 'Budi' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Member UUID (Jika Pelanggan Terdaftar)' })
  @IsOptional()
  @IsUUID()
  member_uuid?: string;

  @ApiPropertyOptional({ description: 'Target Store UUID (Untuk Mutasi)' })
  @IsOptional()
  @IsUUID()
  target_store_uuid?: string;

  // --- INFORMASI PECAHAN PEMBAYARAN ---
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_cash?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_credit?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_installment?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount_bank_total?: number;

  // --- INFORMASI PENGIRIMAN ---
  @ApiPropertyOptional() @IsOptional() @IsNumber() shipping_cost?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() courier_uuid?: string;

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

// =============================================================================
// GLOBAL DEBT & PAYMENT (TETAP SAMA)
// =============================================================================
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