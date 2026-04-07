// src/module/ie/ie.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Res, 
  UseInterceptors, 
  UploadedFile, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  ValidationPipe 
} from '@nestjs/common';
import { IeProductService } from './ie-product.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { GetStore } from 'src/common/decorators/get-store.decorator';

@ApiTags('Import/Export')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('ie') // Prefix utama
export class IeController {
  constructor(private readonly ieProductService: IeProductService) {}

  @Get('product/export')
  @ApiOperation({ summary: 'Export Products to Excel/CSV' })
  async exportProduct(
    @Query('format') format: 'xlsx' | 'xls' | 'csv' = 'xlsx',
    @GetStore() storeUuid: string,
    @Res() res,
  ) {
    const validFormats = ['xlsx', 'xls', 'csv'];
    const selectedFormat = validFormats.includes(format) ? format : 'xlsx';

    const buffer = await this.ieProductService.exportProductData(storeUuid, selectedFormat as any);

    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (selectedFormat === 'csv') contentType = 'text/csv';
    if (selectedFormat === 'xls') contentType = 'application/vnd.ms-excel';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=data_produk_${storeUuid}.${selectedFormat}`);
    
    res.send(buffer);
  }

  @Post('product/import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import Products from Excel/CSV' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importProduct(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    if (!file) {
      throw new ValidationPipe({ transform: true });
    }
    return await this.ieProductService.importProductData(file.buffer, storeUuid, userId);
  }
}