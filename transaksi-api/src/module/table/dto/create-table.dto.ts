import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsOptional } from "class-validator";

export class CreateTableDto {
  @ApiProperty({ example: 'Meja A1', description: 'Nama Meja' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 4, description: 'Kapasitas (jumlah orang)' })
  @IsNotEmpty()
  @IsNumber()
  capacity: number;
}

export class UpdateTableDto {
  @ApiProperty({ example: 'Meja B1', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 6, required: false })
  @IsOptional()
  @IsNumber()
  capacity?: number;
}