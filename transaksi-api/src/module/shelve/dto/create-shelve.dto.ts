import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ShelveType } from 'src/common/entities/product_shelve/product_shelve.entity';

export class CreateShelveDto {
  @ApiProperty({ example: 'Gudang Belakang', description: 'Nama Rak/Gudang' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ShelveType, example: ShelveType.SHELF })
  @IsOptional()
  @IsEnum(ShelveType)
  type?: ShelveType;

  @ApiProperty({ example: 'Deskripsi...', description: 'Deskripsi' })
  @IsOptional()
  @IsString()
  description: string;

  @ApiProperty({ example: 100, description: 'Kapasitas maksimal' })
  @IsNotEmpty()
  @IsNumber()
  capacity: number;
}

export class UpdateShelveDto {
  @ApiProperty({ example: 'Rak A-01 (Depan)', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: ShelveType, example: ShelveType.SHELF })
  @IsOptional()
  @IsEnum(ShelveType)
  type?: ShelveType;

  @ApiProperty({ example: 'Deskripsi baru', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 150, required: false })
  @IsOptional()
  @IsNumber()
  capacity?: number;
}