import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
    @ApiProperty({ example: 'STR-xxxxxxx', required: false })
    @IsOptional()
    @IsString()
    parentStoreUuid?: string;

    // --- Informasi Toko (Cabang) ---
    @ApiProperty({ example: 'Toko Cabang Jakarta' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: 'Jl. Sudirman No. 1' })
    @IsNotEmpty()
    @IsString()
    address: string;

    @ApiProperty({ example: '08123456789' })
    @IsOptional()
    @IsString()
    phone: string;

    // --- Informasi Admin Cabang ---
    @ApiProperty({ example: 'admin_cabang_jkt' })
    @IsNotEmpty()
    @IsString()
    username: string;

    @ApiProperty({ example: 'cabang@example.com' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}