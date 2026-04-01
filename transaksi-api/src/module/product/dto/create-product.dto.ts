import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// 1. DTO Khusus untuk Harga (Bisa dipakai di Produk atau Varian)
export class ProductPriceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uuid?: string; // Untuk update harga lama

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string; // Contoh: "Harga Grosir"

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number; // Nominal harga
}

// 2. DTO Khusus untuk Varian
export class ProductVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uuid?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stock?: number;

  // Relasi Harga di dalam Varian
  @ApiPropertyOptional({ type: [ProductPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices?: ProductPriceDto[];
}

// 3. DTO Utama Produk
export class CreateProductDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stock?: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  unitUuid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  conversionQty?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  shelveUuids: string[];

  // Relasi Harga untuk Produk Utama (Jika tidak pakai varian)
  @ApiPropertyOptional({ type: [ProductPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices?: ProductPriceDto[];

  // Relasi Varian
  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  // (Tetap biarkan relasi Parent/Child jika sebelumnya Anda sudah definisikan di sini)
}