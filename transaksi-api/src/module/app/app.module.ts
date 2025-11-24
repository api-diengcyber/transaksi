import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { AuthModule } from '../auth/auth.module';
import { ShelveModule } from '../shelve/shelve.module';
import { CategoryModule } from '../category/category.module';
import { TableModule } from '../table/table.module';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    JournalModule,
    ProductModule,
    ShelveModule,
    CategoryModule,
    TableModule,
    RecipeModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
