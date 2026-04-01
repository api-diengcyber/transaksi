import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShelveDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'UUID Gudang', required: false }) 
  @IsOptional() @IsString()
  warehouseUuid?: string;
}