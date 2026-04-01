import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'Pcs', description: 'Nama Satuan' })
  @IsString()
  @IsNotEmpty({ message: 'Nama satuan tidak boleh kosong' })
  @MaxLength(500, { message: 'Nama satuan maksimal 500 karakter' })
  name: string;
}