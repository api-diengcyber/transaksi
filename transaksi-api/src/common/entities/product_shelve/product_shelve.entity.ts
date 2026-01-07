import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductShelvePivotEntity } from '../product_shelve_pivot/product_shelve_pivot.entity';

export enum ShelveType {
  WAREHOUSE = 'WAREHOUSE', // Gudang Penyimpanan
  SHELF = 'SHELF',         // Rak Pajangan / Toko
}

@Entity('product_shelve')
export class ProductShelveEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ name: 'store_uuid', length: 60 })
  storeUuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({
    type: 'enum',
    enum: ShelveType,
    default: ShelveType.SHELF
  })
  type: ShelveType;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ type: 'double' })
  capacity: number;

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

  @OneToMany(() => ProductShelvePivotEntity, (ps) => ps.shelve)
  productShelves: ProductShelvePivotEntity[];

  totalItems?: number;
}