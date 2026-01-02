import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJournalConfigDto {
  @ApiProperty({ example: 'SALE' })
  @IsNotEmpty()
  @IsString()
  transactionType: string;

  @ApiProperty({ example: 'grand_total' })
  @IsNotEmpty()
  @IsString()
  detailKey: string;

  @ApiProperty({ example: 'DEBIT', enum: ['DEBIT', 'CREDIT'] })
  @IsNotEmpty()
  @IsEnum(['DEBIT', 'CREDIT'])
  position: 'DEBIT' | 'CREDIT';

  @ApiProperty({ example: 'uuid-akun-kas-besar' })
  @IsNotEmpty()
  @IsString()
  accountUuid: string;
}