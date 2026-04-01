import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { unitProvider } from '../../common/entities/unit/unit.provider';
import { DatabaseModule } from '../../common/db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [UnitController],
  providers: [UnitService, ...unitProvider],
  exports: [UnitService],
})
export class UnitModule {}