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
import { ProductEntity } from '../product/product.entity';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';
import { ShelveEntity } from '../shelve/shelve.entity';

@Entity('product_shelve')
export class ProductShelveEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

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
    
    @ManyToOne(() => ShelveEntity, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'shelve_uuid' })
    shelve: ShelveEntity;
  
    @Column({ name: 'shelve_uuid', type: 'uuid', nullable: true })
    shelveUuid?: string;
  
    @ManyToOne(() => ProductEntity, (product) => product.price, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'product_uuid' })
    product: ProductEntity;
  
    @Column({ name: 'product_uuid', type: 'uuid' })
    productUuid: string;
    
    @ManyToOne(() => ProductUnitEntity, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'unit_uuid' })
    unit: ProductUnitEntity;
  
    @Column({ name: 'unit_uuid', type: 'uuid', nullable: true })
    unitUuid?: string;
}
