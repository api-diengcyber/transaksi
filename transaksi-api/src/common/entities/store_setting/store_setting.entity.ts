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
import { StoreEntity } from '../store/store.entity';

@Entity('store_setting')
export class StoreSettingEntity {
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

  @ManyToOne(() => StoreEntity, (store) => store.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'store_uuid' })
  store: StoreEntity;
  
  @Column({ name: 'store_uuid', type: 'uuid' })
  storeUuid: string;
}
