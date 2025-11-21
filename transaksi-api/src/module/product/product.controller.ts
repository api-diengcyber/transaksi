import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards 
} from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiOperation, ApiBody, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductUnitEnum } from 'src/common/entities/product_unit/product_unit.entity';

import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@ApiTags('Product')
@ApiBearerAuth() // Menambahkan fitur Authorize (Gembok) di Swagger
@UseGuards(AtGuard) // Melindungi seluruh endpoint di controller ini
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('find-all')
  @ApiOperation({ summary: 'Get all products' })
  async findAll(@GetUser('storeUuid') storeUuid: string) {
    return this.productService.findAll(storeUuid);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get product detail' })
  async findOne(
    @Param('uuid') uuid: string,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.findOne(uuid, storeUuid);
  }

  @Post('create')
  @ApiOperation({ summary: 'Create product with units, prices, and stocks' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Kopi Kapal Api' },
        categoryUuids: { // Tambahkan ke Swagger Documentation
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            example: ['cat-uuid-1', 'cat-uuid-2']
        },
        units: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tempId: { type: 'number', example: 1 },
              unitName: { type: 'string', enum: Object.values(ProductUnitEnum), example: 'PCS' },
              unitMultiplier: { type: 'number', example: 1 },
              barcode: { type: 'string', example: '899123456' },
              isDefault: { type: 'boolean', example: true }
            }
          }
        },
        prices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              unitTempId: { type: 'number', example: 1 },
              name: { type: 'string', example: 'Umum' },
              price: { type: 'number', example: 5000 },
              isDefault: { type: 'boolean', example: true }
            }
          }
        },
        stocks: {
           type: 'array',
           items: {
             type: 'object',
             properties: {
               unitTempId: { type: 'number', example: 1 },
               qty: { type: 'number', example: 50 }
             }
           }
        }
      },
      required: ['name', 'units'],
    },
  })
  async create(
    @Body() body: any,
    @GetUser('sub') userId: string,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.create({ ...body, userId, storeUuid });
  }

  @Put('update/:uuid')
  @ApiOperation({ summary: 'Update product name only' })
  async update(
    @Param('uuid') uuid: string,
    @Body() body: any, 
    @GetUser('sub') userId: string ,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.update(uuid, body, userId, storeUuid);
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
    },
    @GetUser('sub') userId: string,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.addUnit(
      productUuid,
      body.unitName,
      body.unitMultiplier,
      body.barcode,
      body.setAsDefault,
      userId,
      storeUuid,
    );
  }

  @Post('add-price/:productUuid') 
  @ApiOperation({ summary: 'Add price to product' })
  async addPrice(
    @Param('productUuid') productUuid: string, 
    @Body() body: { price: number; name: string; unitUuid: string; setAsDefault?: boolean },
    @GetUser('sub') userId: string,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.addPrice(
      productUuid,
      body.price,
      body.unitUuid,
      body.name,
      body.setAsDefault ?? false,
      userId,
      storeUuid,
    );
  }
  
  @Post('add-stock/:productUuid') 
  @ApiOperation({ summary: 'Add stock manually (Adjusment)' })
  async addStock(
    @Param('productUuid') productUuid: string, 
    @Body() body: { qty: number },
    @GetUser('sub') userId: string
  ) {
      return this.productService.addStock(productUuid, body.qty, userId);
  }

  @Delete('delete/:uuid')
  async delete(
    @Param('uuid') uuid: string, 
    @GetUser('sub') userId: string,
    @GetUser('storeUuid') storeUuid: string
  ) {
    return this.productService.softDelete(uuid, userId, storeUuid);
  }

  @Post('restore/:uuid')
  async restore(@Param('uuid') uuid: string) {
    return this.productService.restore(uuid);
  }

  @Delete('delete-unit/:unitUuid')
  @ApiOperation({ summary: 'Delete specific unit from product' })
  async deleteUnit(@Param('unitUuid') unitUuid: string) {
    return this.productService.removeUnit(unitUuid);
  }
}