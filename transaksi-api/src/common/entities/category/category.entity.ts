import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  ManyToOne, // Tambah ini
  OneToMany, // Tambah ini
  JoinColumn, // Tambah ini
} from 'typeorm';
import { ProductEntity } from '../product/product.entity';

@Entity('category')
export class CategoryEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @ManyToOne(() => CategoryEntity, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_uuid' })
  parent: CategoryEntity;

  @Column({ name: 'parent_uuid', nullable: true })
  parentUuid: string;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children: CategoryEntity[];

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

  @ManyToMany(() => ProductEntity, (product) => product.categories)
  products: ProductEntity[];
}