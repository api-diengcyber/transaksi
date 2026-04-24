
import { DataSource } from 'typeorm';
import { JournalTemplateEntity } from './journal_template.entity';

export const journalTemplateProvider = [
  {
    provide: 'JOURNAL_TEMPLATE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(JournalTemplateEntity),
    inject: ['DATA_SOURCE'],
  },
];
