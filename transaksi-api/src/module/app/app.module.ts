import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { AuthModule } from '../auth/auth.module';
import { TableModule } from '../table/table.module';
import { UserModule } from '../user/user.module';
import { ProductionModule } from '../production/production.module';
import { ProductionFlowModule } from '../production_flow/production_flow.module';
import { CourierModule } from '../courier/courier.module';
import { BankModule } from '../bank/bank.module';
import { AccountModule } from '../account/account.module';
import { JournalConfigModule } from '../journal_config/journal_config.module';
import { CategoryModule } from '../category/category.module';
import { UnitModule } from '../unit/unit.module';
import { ShelveModule } from '../shelve/shelve.module';
import { PriceGroupModule } from '../price_group/price_group.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    JournalModule,
    JournalConfigModule,
    ProductModule,
    CategoryModule,
    TableModule,
    UserModule,
    ProductionModule,
    ProductionFlowModule,
    CourierModule,
    BankModule,
    AccountModule,
    UnitModule,
    ShelveModule,
    PriceGroupModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
