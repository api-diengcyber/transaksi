import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';
import { UserEntity } from '../user/user.entity';
import { ProductVariantEntity } from '../product_variant/product_variant.entity';

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

  @ManyToOne(() => ProductEntity, (product) => product.units, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @Column({ name: 'product_uuid', type: 'uuid' })
  productUuid: string;

  @OneToMany(() => ProductPriceEntity, (price) => price.unit)
  prices: ProductPriceEntity[];

  @Column({ name: 'variant_uuid', type: 'uuid', nullable: true })
  variantUuid: string;

  @ManyToOne(() => ProductVariantEntity, (variant) => variant.units)
  @JoinColumn({ name: 'variant_uuid' })
  variant: ProductVariantEntity;
}
