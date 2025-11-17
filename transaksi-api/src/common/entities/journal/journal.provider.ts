
import { DataSource } from 'typeorm';
import { JournalEntity } from './journal.entity';

export const journalProvider = [
  {
    provide: 'JOURNAL_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(JournalEntity),
    inject: ['DATA_SOURCE'],
  },
];
