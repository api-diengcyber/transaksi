import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { TableController } from './table.controller';
import { TableService } from './table.service';
import { tableProvider } from 'src/common/entities/tables/table.provider';

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [TableController],
  providers: [
    ...tableProvider,
    TableService,
  ],
  exports: [TableService],
})
export class TableModule {}