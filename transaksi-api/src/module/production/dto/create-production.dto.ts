import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateProductionDto {
    @IsNotEmpty({ message: 'Nama produksi tidak boleh kosong' })
    @IsString()
    @MaxLength(500)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}