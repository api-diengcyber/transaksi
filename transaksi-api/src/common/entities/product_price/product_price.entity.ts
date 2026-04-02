import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { ProductVariantEntity } from '../product_variant/product_variant.entity';
import { PriceGroupEntity } from '../price_group/price_group.entity';

@Entity('product_price')
export class ProductPriceEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ name: 'product_uuid', nullable: true })
  productUuid: string;

  // Tambahkan relasi ke varian
  @Column({ name: 'variant_uuid', nullable: true })
  variantUuid: string;

  @ManyToOne(() => ProductEntity, (product) => product.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @ManyToOne(() => ProductVariantEntity, (variant) => variant.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_uuid' })
  variant: ProductVariantEntity;

  @Column({ length: 255 })
  name: string;
  
  @Column({ name: 'price_group_uuid' })
  priceGroupUuid: string;

  @ManyToOne(() => PriceGroupEntity)
  @JoinColumn({ name: 'price_group_uuid' })
  priceGroup: PriceGroupEntity;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: number;
  
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy?: string;
}