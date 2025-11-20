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
  ) {
    return this.categoryService.create(body, userId);
  }

  // ================================
  // FIND ALL
  // ================================
  @Get('find-all')
  @ApiOperation({ summary: 'Get all categories' })
  async findAll() {
    return this.categoryService.findAll();
  }

  // ================================
  // FIND ONE
  // ================================
  @Get(':uuid')
  @ApiOperation({ summary: 'Get category detail by UUID' })
  async findOne(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.categoryService.findOne(uuid);
  }

  // ================================
  // UPDATE
  // ================================
  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update category data (support parentUuid)' })
  async update(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() body: UpdateCategoryDto,
    @GetUser('sub') userId: string,
  ) {
    return this.categoryService.update(uuid, body, userId);
  }

  // ================================
  // DELETE (SOFT DELETE)
  // ================================
  @Delete('delete/:uuid')
  @ApiOperation({ summary: 'Soft delete category' })
  async remove(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @GetUser('sub') userId: string,
  ) {
    return this.categoryService.remove(uuid, userId);
  }

  // ================================
  // RESTORE
  // ================================
  @Post('restore/:uuid')
  @ApiOperation({ summary: 'Restore a soft-deleted category' })
  async restore(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.categoryService.restore(uuid);
  }
}
