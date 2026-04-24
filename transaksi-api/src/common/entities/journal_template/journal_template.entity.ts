import { Entity, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('journal_template')
export class JournalTemplateEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column()
  storeUuid: string;

  @Column({ unique: true })
  templateCode: string;

  @Column()
  templateName: string;

  @CreateDateColumn()
  createdAt: Date;
}