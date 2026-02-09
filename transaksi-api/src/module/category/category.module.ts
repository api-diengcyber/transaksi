import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { DatabaseModule } from '../../common/db/database.module';
import { categoryProvider } from 'src/common/entities/category/category.provider';
import { CategoryController } from './category.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController],
  providers: [
    CategoryService,
    ...categoryProvider
  ],
  exports: [CategoryService],
})
export class CategoryModule { }