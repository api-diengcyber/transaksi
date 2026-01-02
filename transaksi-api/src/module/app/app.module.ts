import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { AuthModule } from '../auth/auth.module';
import { ShelveModule } from '../shelve/shelve.module';
import { CategoryModule } from '../category/category.module';
import { TableModule } from '../table/table.module';
import { RecipeModule } from '../recipe/recipe.module';
import { UserModule } from '../user/user.module';
import { ProductionModule } from '../production/production.module';
import { ProductionFlowModule } from '../production_flow/production_flow.module';
import { CourierModule } from '../courier/courier.module';
import { BankModule } from '../bank/bank.module';
import { AccountModule } from '../account/account.module';
import { JournalConfigModule } from '../journal_config/journal_config.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    JournalModule,
    JournalConfigModule,
    ProductModule,
    ShelveModule,
    CategoryModule,
    TableModule,
    RecipeModule,
    UserModule,
    ProductionModule,
    ProductionFlowModule,
    CourierModule,
    BankModule,
    AccountModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
