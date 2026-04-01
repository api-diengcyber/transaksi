import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString()
  address?: string;
}