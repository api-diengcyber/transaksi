
import { DataSource } from 'typeorm';
import { JournalConfigEntity } from './journal_config.entity';

export const journalConfigProvider = [
  {
    provide: 'JOURNAL_CONFIG_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(JournalConfigEntity),
    inject: ['DATA_SOURCE'],
  },
];
