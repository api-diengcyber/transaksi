import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { StoreEntity } from '../store/store.entity';
import { UserRoleEntity } from '../user_role/user_role.entity';

@Entity('user')
export class UserEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;
  
  @Column({ length: 500, nullable: true })
  name: string;

  @Column({ length: 100, nullable: true })
  phone: string;

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

  @ManyToMany(() => UserRoleEntity, (role) => role.users)
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
  roles: UserRoleEntity[];

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