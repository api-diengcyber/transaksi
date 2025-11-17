import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';
import * as productDto from './dto/product.dto';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('find-all')
  @ApiOperation({ summary: 'Get all products' })
  async findAll() {
    return this.productService.findAll();
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get product detail' })
  async findOne(@Param('uuid') uuid: string) {
    return this.productService.findOne(uuid);
  }

  @Post('create')
  @ApiOperation({ summary: 'Create product with units (barcode per unit)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Indomie Goreng' },
        userId: { type: 'string', example: 'user-uuid-123' },
        units: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              unitName: { type: 'string', enum: Object.values(ProductUnitEnum), example: 'PCS' },
              unitMultiplier: { type: 'number', example: 1 },
              price: { type: 'number', example: 3500 },
              stock: { type: 'number', example: 100 },
              barcode: { type: 'string', example: '89988662001' },
              isDefault: { type: 'boolean', example: true }
            }
          }
        }
      },
      required: ['name', 'units'],
    },
  })
  async create(@Body() body: productDto.CreateProductDto) {
    return this.productService.create(body);
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update product name only' })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: { name: string; userId?: string },
  ) {
    return this.productService.update(uuid, body.name, body.userId);
  }

  @Post('add-unit/:productUuid')
  @ApiOperation({ summary: 'Add unit to product' })
  async addUnit(
    @Param('productUuid') productUuid: string,
    @Body() body: { 
        unitName: ProductUnitEnum; 
        unitMultiplier: number; 
        barcode: string; 
        setAsDefault?: boolean; 
        userId?: string 
    },
  ) {
    return this.productService.addUnit(
      productUuid,
      body.unitName,
      body.unitMultiplier,
      body.barcode,
      body.setAsDefault,
      body.userId,
    );
  }

  @Delete('delete/:uuid')
  async delete(@Param('uuid') uuid: string, @Body() body: { userId?: string }) {
    return this.productService.softDelete(uuid, body.userId);
  }

  @Post('restore/:uuid')
  async restore(@Param('uuid') uuid: string) {
    return this.productService.restore(uuid);
  }
  
  @Post('add-price/:productUuid') 
  @ApiOperation({ summary: 'Add price to product' })
  async addPrice(
    @Param('productUuid') productUuid: string, 
    @Body() body: { price: number; unitUuid: string; setAsDefault?: boolean; userId?: string },
  ) {
    return this.productService.addPrice(
      productUuid,
      body.price,
      body.unitUuid,
      body.setAsDefault ?? false,
      body.userId,
    );
  }

  @Delete('delete-unit/:unitUuid')
  @ApiOperation({ summary: 'Delete specific unit from product' })
  async deleteUnit(@Param('unitUuid') unitUuid: string) {
    return this.productService.removeUnit(unitUuid);
  }
}