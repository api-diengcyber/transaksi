import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';

@Entity('product_stock')
export class ProductStockEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ type: 'double', default: 0 })
  qty: number;

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

  @ManyToOne(() => ProductEntity, (product) => product.stock, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @Column({ name: 'product_uuid', type: 'uuid' })
  productUuid: string;
  
  @OneToOne(() => ProductUnitEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_uuid' })
  unit: ProductUnitEntity;

  @Column({ name: 'unit_uuid', type: 'uuid', nullable: true })
  unitUuid?: string;
}
