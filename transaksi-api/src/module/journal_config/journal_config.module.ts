import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { JournalConfigController } from './journal_config.controller';
import { JournalConfigService } from './journal_config.service';
import { journalConfigProvider } from 'src/common/entities/journal_config/journal_config.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [JournalConfigController],
  providers: [
    ...journalConfigProvider,
    JournalConfigService,
  ],
  exports: [JournalConfigService],
})
export class JournalConfigModule {}