import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/db/database.module';
import { PaymentMethodService } from './payment-method.service';
import { paymentMethodProviders } from 'src/common/entities/payment_method/payment_method.provider';
import { PaymentMethodController } from './payment_method.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService, ...paymentMethodProviders],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}