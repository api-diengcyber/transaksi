import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';

@Entity('product_variant')
export class ProductVariantEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ name: 'product_uuid' })
  productUuid: string;

  @ManyToOne(() => ProductEntity, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @Column({ length: 255 })
  name: string; // Contoh: "Merah", "XL", "Pedas Manis"

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy?: string;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy?: string;
  
  @OneToMany(() => ProductPriceEntity, (price) => price.variant, { cascade: true })
  prices: ProductPriceEntity[];
}