import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SettingItemDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  value: string;
}

export class SaveSettingDto {
  @ApiProperty({ example: 'Toko Makmur Jaya' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Jl. Raya No. 1' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '08123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ type: [SettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  settings: SettingItemDto[];
}