import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { ShelveController } from './shelve.controller';
import { shelveProvider } from 'src/common/entities/shelve/shelve.provider';
import { ShelveService } from './shelve.service';

@Module({
    imports: [
        DatabaseModule
    ],
    controllers: [ShelveController],
    providers: [
        ...shelveProvider,
        ShelveService,
    ],
    exports: [ShelveService],
})
export class ShelveModule { }