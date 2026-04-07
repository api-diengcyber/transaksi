// src/module/ie/ie.module.ts
import { Module } from '@nestjs/common';
import { IeController } from './ie.controller';
import { IeProductService } from './ie-product.service';
import { ProductModule } from '../product/product.module'; 

// Import Provider
import { databaseProvider } from 'src/common/db/database.provider';
import { productProvider } from 'src/common/entities/product/product.provider';
import { categoryProvider } from 'src/common/entities/category/category.provider';
import { brandProvider } from 'src/common/entities/brand/brand.provider';      
import { unitProvider } from 'src/common/entities/unit/unit.provider';         
import { shelveProvider } from 'src/common/entities/shelve/shelve.provider';   

@Module({
  imports: [ProductModule], 
  controllers: [IeController],
  providers: [
    IeProductService,
    ...databaseProvider,
    ...productProvider,
    ...categoryProvider,
    ...brandProvider,   
    ...unitProvider,    
    ...shelveProvider,  
  ],
})
export class IeModule {}