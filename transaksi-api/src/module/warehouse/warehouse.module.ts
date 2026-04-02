import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { WarehouseController } from './warehouse.controller';
import { warehouseProvider } from 'src/common/entities/warehouse/warehouse.provider';
import { WarehouseService } from './warehouse.service';
import { JournalModule } from '../journal/journal.module';

@Module({
    imports: [
        DatabaseModule,
        JournalModule
    ],
    controllers: [WarehouseController],
    providers: [
        ...warehouseProvider,
        WarehouseService,
    ],
    exports: [WarehouseService],
})
export class WarehouseModule { }