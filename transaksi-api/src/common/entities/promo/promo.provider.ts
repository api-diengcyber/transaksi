

import { DataSource } from 'typeorm';
import { PromoEntity } from './promo.entity';

export const promoProvider = [
    {
        provide: 'PROMO_REPOSITORY',
        useFactory: (dataSource: DataSource) => dataSource.getRepository(PromoEntity),
        inject: ['DATA_SOURCE'],
    },
];
