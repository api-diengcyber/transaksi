import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { productionProvider } from 'src/common/entities/production/production.provider';
import { DatabaseModule } from 'src/common/db/database.module';

@Module({
    imports: [
        DatabaseModule
    ],
    controllers: [ProductionController],
    providers: [
        ...productionProvider,
        ProductionService
    ],
    exports: [ProductionService],
})
export class ProductionModule { }