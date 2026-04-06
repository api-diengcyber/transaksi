import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { DatabaseModule } from '../../common/db/database.module';
import { brandProvider } from 'src/common/entities/brand/brand.provider';
import { BrandController } from './brand.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [BrandController],
  providers: [
    BrandService,
    ...brandProvider
  ],
  exports: [BrandService],
})
export class BrandModule { }