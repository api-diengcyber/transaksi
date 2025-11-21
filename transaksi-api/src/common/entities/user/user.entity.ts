import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StoreEntity } from '../store/store.entity';
import { RoleEntity } from '../role/role.entity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ length: 500, unique: true })
  username: string;

  @Column({ length: 500 })
  password: string;

  @Column({ length: 500, nullable: true })
  email: string;
  
  @Column({ name: 'refresh_token', nullable: true })
  refreshToken: string;

  @Column({ name: 'default_store_uuid', type: 'uuid', nullable: true })
  defaultStoreUuid: string;

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

  @ManyToMany(() => RoleEntity, (role) => role.users)
  @JoinTable({
    name: 'user_roles_pivot',
    joinColumn: {
      name: 'user_uuid',
      referencedColumnName: 'uuid',
    },
    inverseJoinColumn: {
      name: 'role_uuid',
      referencedColumnName: 'uuid',
    },
  })
  roles: RoleEntity[];

  @ManyToOne(() => StoreEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_store_uuid' })
  defaultStore: StoreEntity;

  @ManyToMany(() => StoreEntity, (store) => store.users)
  @JoinTable({
    name: 'user_stores_pivot',
    joinColumn: {
      name: 'user_uuid',
      referencedColumnName: 'uuid',
    },
    inverseJoinColumn: {
      name: 'store_uuid',
      referencedColumnName: 'uuid',
    },
  })
  stores: StoreEntity[];
}