
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { productCategoryProvider } from 'src/common/entities/product_category/product_category.provider';
import { categoryProvider } from 'src/common/entities/category/category.provider';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController],
  providers: [
    ...categoryProvider,
    ...productCategoryProvider,
    CategoryService,
  ],
  exports: [CategoryService],
})
export class CategoryModule { }
