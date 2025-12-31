import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookTableDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsNotEmpty()
  @IsString()
  bookingName: string;

  @ApiProperty({ example: '2023-12-31T19:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  bookingTime: Date;

  // [BARU] Field Catatan
  @ApiPropertyOptional({ example: 'Minta kursi bayi, jangan dekat speaker' })
  @IsOptional()
  @IsString()
  notes?: string;
}