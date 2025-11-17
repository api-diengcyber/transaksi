import { Module } from '@nestjs/common';
import { JournalModule } from '../journal/journal.module';
import { ProductModule } from '../product/product.module';
import { StoreModule } from '../store/store.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    StoreModule,
    AuthModule,
    JournalModule,
    ProductModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
