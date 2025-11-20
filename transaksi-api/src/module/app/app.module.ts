import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { AuthModule } from '../auth/auth.module';
import { ShelveModule } from '../shelve/shelve.module';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    JournalModule,
    ProductModule,
    ShelveModule,
    CategoryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
