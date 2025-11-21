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
import { UserEntity } from '../user/user.entity';

@Entity('product_shelve')
export class ProductShelveEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    qty: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt?: Date;

    @Column({ name: 'created_by', type: 'uuid', nullable: true })
    createdBy?: string;
          
    @ManyToOne(() => UserEntity)
    @JoinColumn({ name: 'created_by' })
    createdByUser?: UserEntity;

    @Column({ name: 'updated_by', type: 'uuid', nullable: true })
    updatedBy?: string;
            
    @ManyToOne(() => UserEntity)
    @JoinColumn({ name: 'updated_by' })
    updatedByUser?: UserEntity;

    @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
    deletedBy?: string;
            
    @ManyToOne(() => UserEntity)
    @JoinColumn({ name: 'deleted_by' })
    deletedByUser?: UserEntity;
    
    @ManyToOne(() => ShelveEntity, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'shelve_uuid' })
    shelve: ShelveEntity;
  
    @Column({ name: 'shelve_uuid', type: 'uuid', nullable: true })
    shelveUuid?: string;
  
    @ManyToOne(() => ProductEntity, (product) => product.shelve, { // Pastikan relasi di ProductEntity bernama 'shelve'
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