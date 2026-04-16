import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { promoProvider } from 'src/common/entities/promo/promo.provider';
import { PromoController } from './promo.controller';
import { PromoService } from './promo.service';

@Module({
    imports: [
        DatabaseModule
    ],
    controllers: [PromoController],
    providers: [
        ...promoProvider,
        PromoService,
    ],
    exports: [PromoService],
})
export class PromoModule { }