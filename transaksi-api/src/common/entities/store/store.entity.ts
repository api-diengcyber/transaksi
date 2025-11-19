import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { StoreSettingEntity } from '../store_setting/store_setting.entity';
import { UserEntity } from '../user/user.entity';

@Entity('store')
export class StoreEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ length: 50, nullable: true })
  phone: string;

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

  @ManyToMany(() => UserEntity, (user) => user.stores)
  users: UserEntity[];

  @OneToMany(() => StoreSettingEntity, (setting) => setting.store)
  settings: StoreSettingEntity[];
}