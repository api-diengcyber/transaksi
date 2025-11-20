import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Kategori A-01', description: 'Nama Kategori' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '8f4c3db3-1d2a-4ad8-a788-d3cc1b2ff102',
    required: false,
    description: 'UUID parent category (opsional)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentUuid?: string | null;
}

export class UpdateCategoryDto {
  @ApiProperty({
    example: 'Kategori A-01',
    required: false,
    description: 'Nama kategori',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'dba9321a-111d-4735-9c4d-72c1f12e8acc',
    required: false,
    description: 'UUID parent category (opsional). Set null untuk menghapus parent.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentUuid?: string | null;
}
