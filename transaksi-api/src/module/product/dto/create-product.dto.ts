import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Kopi Kapal Api', description: 'Nama Produk' })
  @IsString()
  @IsNotEmpty({ message: 'Nama produk tidak boleh kosong' })
  @MaxLength(500, { message: 'Nama produk maksimal 500 karakter' })
  name: string;

  @ApiProperty({ example: '1234567890123', description: 'Barcode Produk', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Barcode produk maksimal 100 karakter' })
  barcode?: string;
  
  @ApiPropertyOptional({ example: ['uuid-cat-1', 'uuid-cat-2'], description: 'List UUID Kategori' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // Validasi tiap item harus string
  categoryUuids?: string[];
}