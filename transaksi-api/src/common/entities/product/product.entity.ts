import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CategoryEntity } from '../category/category.entity';
import { ProductVariantEntity } from '../product_variant/product_variant.entity';
import { UnitEntity } from '../unit/unit.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';
import { ShelveEntity } from '../shelve/shelve.entity';
import { BrandEntity } from '../brand/brand.entity';

@Entity('product')
export class ProductEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({ length: 100, nullable: true })
  barcode: string;

  @Column({ name: 'conversion_qty', type: 'int', default: 1 })
  conversionQty: number;

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

  @Column({ name: 'category_uuid', nullable: true })
  categoryUuid: string;

  @ManyToMany(() => CategoryEntity, (category) => category.products, {
    cascade: true,
  })
  @JoinTable({
    name: 'product_category_relation',
    joinColumn: {
      name: 'product_uuid',
      referencedColumnName: 'uuid',
    },
    inverseJoinColumn: {
      name: 'category_uuid',
      referencedColumnName: 'uuid',
    },
  })
  categories: CategoryEntity[];

  // TAMBAHKAN KODE INI UNTUK RELASI RAK
  @ManyToMany(() => ShelveEntity, {
    cascade: true,
  })
  @JoinTable({
    name: 'product_shelve_relation',
    joinColumn: {
      name: 'product_uuid',
      referencedColumnName: 'uuid',
    },
    inverseJoinColumn: {
      name: 'shelve_uuid',
      referencedColumnName: 'uuid',
    },
  })
  shelves: ShelveEntity[];

  @Column({ name: 'unit_uuid', nullable: true })
  unitUuid: string;

  @ManyToOne(() => UnitEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_uuid' })
  unit: UnitEntity;

  @OneToMany(() => ProductVariantEntity, (variant) => variant.product, { 
    cascade: true, 
    orphanedRowAction: 'soft-delete'
  })
  variants: ProductVariantEntity[];

  @OneToMany(() => ProductPriceEntity, (price) => price.product, { 
    cascade: true, 
    orphanedRowAction: 'soft-delete' 
  })
  prices: ProductPriceEntity[];

  @Column({ default: true })
  isManageStock: boolean;

  @ManyToOne(() => BrandEntity, (brand) => brand.products)
  @JoinColumn({ name: 'brandUuid', referencedColumnName: 'uuid' })
  brand: BrandEntity;

  @Column({ nullable: true })
  brandUuid: string;
}
