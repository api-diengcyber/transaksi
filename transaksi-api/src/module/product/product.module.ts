
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { ProductController } from './product.controller';
import { productProvider } from 'src/common/entities/product/product.provider';
import { ProductService } from './product.service';
import { JournalModule } from '../journal/journal.module';
import { categoryProvider } from 'src/common/entities/category/category.provider';

@Module({
  imports: [
    DatabaseModule,
    JournalModule
  ],
  controllers: [ProductController],
  providers: [
    ...productProvider,
    ...categoryProvider,
    ProductService,
  ],
  exports: [ProductService],
})
export class ProductModule { }
