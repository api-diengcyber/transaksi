
import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemLogService } from './system-log.service';

@Module({
  imports: [
  ],
  controllers: [
    SystemController,
  ],
  providers: [
    SystemService,
    SystemLogService,
  ],
})
export class SystemModule {}
