
import { DataSource } from 'typeorm';
import { JournalDetailEntity } from './journal_detail.entity';

export const journalDetailProvider = [
  {
    provide: 'JOURNAL_DETAIL_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(JournalDetailEntity),
    inject: ['DATA_SOURCE'],
  },
];
