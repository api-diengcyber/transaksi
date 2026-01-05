import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { UserRole } from 'src/common/entities/user_role/user_role.entity';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create new user/member' })
  async create(
    @Body() dto: CreateUserDto,
    @GetUser('sub') creatorId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.userService.create(dto, creatorId, storeUuid);
  }

  @Get('find-all')
  @ApiOperation({ summary: 'Get users with filters' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @GetStore() storeId: string, 
    @Query('role') role?: UserRole,
    @Query('search') search?: string
  ) {
    return this.userService.findAll(storeId, role, search);
  }

  @Get('roles')
  async findAllRoles() {
    return this.userService.findAllRoles();
  }

  @Get(':uuid')
  async findOne(@Param('uuid') uuid: string, @GetStore() storeUuid: string) {
    return this.userService.findOne(uuid, storeUuid);
  }

  @Put('update/:uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserDto,
    @GetUser('sub') updaterId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.userService.update(uuid, dto, updaterId, storeUuid);
  }
  
  @Put('update-password/:uuid')
  async updatePassword(
    @Param('uuid') uuid: string,
    @Body('password') password: string,
    @GetUser('sub') updaterId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.userService.updatePassword(uuid, password, updaterId, storeUuid);
  }

  @Delete('delete/:uuid')
  async remove(@Param('uuid') uuid: string, @GetUser('sub') deleterId: string, @GetStore() storeUuid: string) {
    return this.userService.softDelete(uuid, deleterId, storeUuid);
  }
}