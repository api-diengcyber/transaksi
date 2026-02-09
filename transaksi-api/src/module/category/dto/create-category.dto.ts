// create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Elektronik' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'uuid-parent-kategori', description: 'UUID Kategori Induk (jika ada)' })
  @IsOptional()
  @IsString()
  parentUuid?: string;
}