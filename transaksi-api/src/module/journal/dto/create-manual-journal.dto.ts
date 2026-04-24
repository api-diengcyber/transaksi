import { IsString, IsArray, IsOptional, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class JournalManualEntryDto {
  @IsString() accountUuid: string;
  @IsString() accountCode: string;
  @IsString() accountName: string;
  @IsNumber() debit: number;
  @IsNumber() credit: number;
  @IsString() @IsOptional() detailKey?: string; // Untuk template existing
}

export class CreateManualJournalDto {
  @IsString() date: string;
  @IsString() @IsOptional() note: string;
  
  @IsString() @IsOptional() templateCode?: string; // Jika menggunakan template yang sudah ada
  @IsBoolean() @IsOptional() saveAsTemplate?: boolean; // Jika ingin save template baru
  @IsString() @IsOptional() templateName?: string; // Nama template baru

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalManualEntryDto)
  entries: JournalManualEntryDto[];
}