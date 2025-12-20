import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Product Category')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  // ================================
  // CREATE
  // ================================
  @Post('create')
  @ApiOperation({ summary: 'Create new category (support parentUuid)' })
  async create(
    @Body() body: CreateCategoryDto,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.categoryService.create(body, userId, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  // ================================
  // FIND ALL
  // ================================
  @Get('find-all')
  @ApiOperation({ summary: 'Get all categories' })
  async findAll(
    @GetStore() storeUuid: string,
  ) {
    return this.categoryService.findAll(storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  // ================================
  // FIND ONE
  // ================================
  @Get(':uuid')
  @ApiOperation({ summary: 'Get category detail by UUID' })
  async findOne(
    @Param('uuid') uuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.categoryService.findOne(uuid, storeUuid);
  }

  // ================================
  // UPDATE
  // ================================
  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update category data (support parentUuid)' })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: UpdateCategoryDto,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.categoryService.update(uuid, body, userId, storeUuid);
  }

  // ================================
  // DELETE (SOFT DELETE)
  // ================================
  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Soft delete category' })
  async remove(
    @Param('uuid') uuid: string,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.categoryService.remove(uuid, userId, storeUuid); // <-- [UPDATED] Teruskan storeUuid
  }

  // ================================
  // RESTORE
  // ================================
  @Post('restore/:uuid')
  @ApiOperation({ summary: 'Restore a soft-deleted category' })
  async restore(@Param('uuid') uuid: string) {
    return this.categoryService.restore(uuid);
  }
}
