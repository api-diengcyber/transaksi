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
import { ProductStockEntity } from '../product_stock/product_stock.entity';

export enum ProductUnitEnum {
  PCS = 'PCS',
  LUSIN = 'LUSIN',
  DUS = 'DUS',
  KARTON = 'KARTON',
  BOX = 'BOX',    
  KG = 'KG',         
  LITER = 'LITER',   
  PACK = 'PACK',     
}

@Entity('product_unit')
export class ProductUnitEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({
    type: 'enum',
    enum: ProductUnitEnum,
    name: 'unit_name',
  })
  unitName: ProductUnitEnum;

  @Column({
    type: 'double precision',
    name: 'unit_multiplier',
    default: 1,
  })
  unitMultiplier: number;

  @Column({ length: 500, nullable: true })
  barcode: string;

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

  @ManyToOne(() => ProductEntity, (product) => product.units, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @Column({ name: 'product_uuid', type: 'uuid' })
  productUuid: string;
  
  @OneToOne(() => ProductStockEntity, (stock) => stock.unit)
  stock?: ProductStockEntity;
}
