import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';

// Import DTOs
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Product')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Get('find-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get All Products with Pagination' })
  @UsePipes(new ValidationPipe({ transform: true })) // Transform query params string -> number
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = ''
  ) {
    return await this.productService.findAll(Number(page), Number(limit), search);
  }

  @Get(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get One Product' })
  async findOne(@Param('uuid') uuid: string) {
    return await this.productService.findOne(uuid);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  async create(@Body() createProductDto: CreateProductDto) {
    return await this.productService.create(createProductDto);
  }

  @Put('update/:uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Product' })
  async update(
    @Param('uuid') uuid: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    return await this.productService.update(uuid, updateProductDto);
  }

  @Delete('delete/:uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Product (Soft)' })
  async delete(@Param('uuid') uuid: string) {
    return await this.productService.delete(uuid);
  }
}