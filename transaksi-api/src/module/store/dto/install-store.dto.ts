import { IsString, IsArray, ValidateNested, IsOptional, IsEmail, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class StoreSettingDto {
  @IsString() key: string;
  @IsString() value: string;
}

export class InstallStoreDto {
  // --- DATA TOKO ---
  @IsString() 
  name: string;

  @IsOptional()
  @IsString() 
  address?: string;

  @IsOptional()
  @IsString() 
  phone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreSettingDto)
  settings?: StoreSettingDto[];

  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}