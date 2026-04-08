// src/module/ie/ie.module.ts
import { Module } from '@nestjs/common';
import { IeController } from './ie.controller';
import { IeProductService } from './ie-product.service';
import { ProductModule } from '../product/product.module'; 

// Import Provider
import { productProvider } from 'src/common/entities/product/product.provider';
import { categoryProvider } from 'src/common/entities/category/category.provider';
import { brandProvider } from 'src/common/entities/brand/brand.provider';      
import { unitProvider } from 'src/common/entities/unit/unit.provider';         
import { shelveProvider } from 'src/common/entities/shelve/shelve.provider';   
import { DatabaseModule } from 'src/common/db/database.module';
import { priceGroupProviders } from 'src/common/entities/price_group/price_group.provider';

@Module({
  imports: [
    DatabaseModule,
    ProductModule
  ], 
  controllers: [IeController],
  providers: [
    IeProductService,
    ...productProvider,
    ...categoryProvider,
    ...brandProvider,   
    ...unitProvider,    
    ...shelveProvider,  
    ...priceGroupProviders,
  ],
})
export class IeModule {}