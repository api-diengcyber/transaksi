
// src/module/user/user.controller.ts

import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create new user and assign roles to the current store' })
  async create(
    @Body() dto: CreateUserDto,
    @GetUser('sub') creatorId: string,
    @GetUser('storeUuid') storeUuid: string,
  ) {
    return this.userService.create(dto, creatorId, storeUuid);
  }

  @Get('find-all')
  @ApiOperation({ summary: 'Get all users belonging to the current store' })
  async findAll(
    @GetUser('storeUuid') storeUuid: string,
  ) {
    return this.userService.findAll(storeUuid);
  }
  
  @Get('roles')
  @ApiOperation({ summary: 'Get all available roles' })
  async findAllRoles() {
    return this.userService.findAllRoles();
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get user detail by UUID (must belong to the current store)' })
  async findOne(
    @Param('uuid') uuid: string,
    @GetUser('storeUuid') storeUuid: string,
  ) {
    return this.userService.findOne(uuid, storeUuid);
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update user data and roles' })
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserDto,
    @GetUser('sub') updaterId: string,
    @GetUser('storeUuid') storeUuid: string,
  ) {
    return this.userService.update(uuid, dto, updaterId, storeUuid);
  }
  
  @Put('update-password/:uuid')
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({ schema: { type: 'object', properties: { password: { type: 'string' } } } })
  async updatePassword(
    @Param('uuid') uuid: string,
    @Body('password') password: string,
    @GetUser('sub') updaterId: string,
    @GetUser('storeUuid') storeUuid: string,
  ) {
    if (!password || password.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters long.');
    }
    return this.userService.updatePassword(uuid, password, updaterId, storeUuid);
  }

  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Soft delete user' })
  async remove(
    @Param('uuid') uuid: string,
    @GetUser('sub') deleterId: string,
    @GetUser('storeUuid') storeUuid: string,
  ) {
    return this.userService.softDelete(uuid, deleterId, storeUuid);
  }
}