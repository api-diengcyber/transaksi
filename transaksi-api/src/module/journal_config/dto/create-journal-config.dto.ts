import { IsNotEmpty, IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class JournalConfigItemDto {
  @ApiProperty({ example: 'DEBIT', enum: ['DEBIT', 'CREDIT'] })
  @IsNotEmpty()
  @IsEnum(['DEBIT', 'CREDIT'])
  position: 'DEBIT' | 'CREDIT';

  @ApiProperty({ example: 'uuid-akun-kas-besar' })
  @IsNotEmpty()
  @IsString()
  accountUuid: string;
}

export class CreateJournalConfigDto {
  @ApiProperty({ example: 'SALE' })
  @IsNotEmpty()
  @IsString()
  transactionType: string;

  @ApiProperty({ example: 'grand_total' })
  @IsNotEmpty()
  @IsString()
  detailKey: string;

  @ApiProperty({ type: [JournalConfigItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalConfigItemDto)
  items: JournalConfigItemDto[];
}