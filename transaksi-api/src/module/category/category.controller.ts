import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { AtGuard } from 'src/common/guards/at.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

// Import DTOs
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

@ApiTags('Category')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Get('find-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Categories with Pagination & Parent Info' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: CategoryQueryDto) {
    return await this.categoryService.findAll(query);
  }

  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get One Category Detail' })
  async findOne(@Param('uuid') uuid: string) {
    return await this.categoryService.findOne(uuid);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create New Category' })
  async create(@Body() createDto: CreateCategoryDto) {
    return await this.categoryService.create(createDto);
  }

  @Put('update/:uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Category' })
  async update(
    @Param('uuid') uuid: string,
    @Body() updateDto: UpdateCategoryDto
  ) {
    return await this.categoryService.update(uuid, updateDto);
  }

  @Delete('delete/:uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Category (Soft)' })
  async delete(@Param('uuid') uuid: string) {
    return await this.categoryService.delete(uuid);
  }
}