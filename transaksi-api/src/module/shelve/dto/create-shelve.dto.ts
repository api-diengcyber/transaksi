import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateShelveDto {
  @ApiProperty({ example: 'Rak A-01 (Depan)', description: 'Nama Rak' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Rak khusus barang pecah belah', description: 'Deskripsi Rak' })
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty({ example: 100, description: 'Kapasitas maksimal rak' })
  @IsNotEmpty()
  @IsNumber()
  capacity: number;
}

export class UpdateShelveDto {
  @ApiProperty({ example: 'Rak A-01 (Depan)', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Deskripsi baru', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 150, required: false })
  @IsOptional()
  @IsNumber()
  capacity?: number;
}