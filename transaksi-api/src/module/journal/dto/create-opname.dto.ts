// src/module/journal/dto/create-opname.dto.ts
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class OpnameItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  product_uuid: string;

  @ApiProperty()
  @IsNumber()
  system_stock: number;

  @ApiProperty()
  @IsNumber()
  actual_stock: number;

  @ApiProperty()
  @IsNumber()
  difference: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateOpnameDraftDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  warehouse_uuid: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  user_uuid: string; // PIC yang melakukan opname

  @ApiProperty({ type: [OpnameItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpnameItemDto)
  items: OpnameItemDto[];
}