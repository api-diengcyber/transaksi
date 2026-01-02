import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AccountEntity } from '../account/account.entity';
import { StoreEntity } from '../store/store.entity';

@Entity('journal_config')
export class JournalConfigEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  // Contoh: 'SALE', 'BUY', 'AR', 'PAY_AP'
  @Column({ name: 'transaction_type', length: 50 })
  transactionType: string;

  // Contoh: 'grand_total', 'nominal_ar', 'stok_min_'
  // Tips: Akhiri dengan '_' jika ingin menangkap key dinamis (wildcard)
  @Column({ name: 'detail_key', length: 100 })
  detailKey: string;

  // 'DEBIT' atau 'CREDIT'
  @Column({ length: 10 })
  position: string;

  @ManyToOne(() => AccountEntity, { eager: true }) 
  @JoinColumn({ name: 'account_uuid' })
  account: AccountEntity;

  @Column({ name: 'account_uuid' })
  accountUuid: string;

  @ManyToOne(() => StoreEntity)
  @JoinColumn({ name: 'store_uuid' })
  store: StoreEntity;

  @Column({ name: 'store_uuid' })
  storeUuid: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string;
}