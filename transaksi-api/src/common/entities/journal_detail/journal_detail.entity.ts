import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { JournalEntity } from '../journal/journal.entity';

@Entity('journal_detail')
export class JournalDetailEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ length: 500 })
  key: string;

  @Column({ length: 500 })
  value: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string;

  @ManyToOne(() => JournalEntity, (journal) => journal.details, {
    onDelete: 'CASCADE', 
  })
  @JoinColumn({ name: 'journal_code', referencedColumnName: 'code' })
  journal: JournalEntity;

  @Column({ name: 'journal_code' })
  journalCode: string;
}
