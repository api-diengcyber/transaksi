import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// 1. DTO Khusus untuk Harga
export class ProductPriceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uuid?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  priceGroupUuid: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  // TAMBAHAN: Validasi DTO untuk minQty
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minQty?: number; 
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

  // PENYEBAB ERROR 2: Kategori sebelumnya belum didaftarkan di DTO
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  categoryUuid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  conversionQty?: number;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  shelveUuids: string[];

  @ApiPropertyOptional({ type: [ProductPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices?: ProductPriceDto[];

  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiProperty()
  @IsOptional()
  @IsString()
  brandUuid?: string;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isManageStock?: boolean;
}