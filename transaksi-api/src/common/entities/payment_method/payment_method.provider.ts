// src/common/entities/payment_method/payment_method.provider.ts
import { DataSource } from 'typeorm';
import { PaymentMethodEntity } from './payment_method.entity';

export const paymentMethodProviders = [
  {
    provide: 'PAYMENT_METHOD_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(PaymentMethodEntity),
    inject: ['DATA_SOURCE'],
  },
];