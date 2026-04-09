// src/module/user/dto/user.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, IsArray, ArrayMinSize, IsEnum, IsUUID } from 'class-validator';
import { UserRole } from 'src/common/entities/user_role/user_role.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Ujang Kasir' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'kasir' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: '12341234' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'kasir@email.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: ['role-uuid'], isArray: true, description: 'Array of Role UUIDs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true }) // Ubah dari IsEnum ke IsString karena yang dikirim UUID
  roles: string[]; 
}

export class UpdateUserDto {
  @ApiProperty({ example: 'Ujang Kasir', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'ujangkasir', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'ujang@toko.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  // --- TAMBAHKAN INI ---
  @ApiProperty({ example: 'passwordbaru123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
  // --------------------

  @ApiProperty({ example: ['role-uuid'], isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
  
  @ApiProperty({ example: 'newstore-uuid', required: false })
  @IsOptional()
  @IsUUID()
  defaultStoreUuid?: string; 
}