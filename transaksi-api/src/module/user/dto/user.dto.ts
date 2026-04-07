// src/module/user/dto/user.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional, IsEmail, IsArray, ArrayMinSize, IsEnum, IsUUID } from 'class-validator';
import { UserRole } from 'src/common/entities/user_role/user_role.entity';

export class CreateUserDto {
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
  @ApiProperty({ example: 'ujangkasir', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'ujang@toko.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: [UserRole.CASHIER], isArray: true, enum: UserRole, description: 'Role pengguna', required: false })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
  
  @ApiProperty({ example: 'newstore-uuid', required: false, description: 'UUID toko default' })
  @IsOptional()
  @IsUUID()
  defaultStoreUuid?: string; 
}