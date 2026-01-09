import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';
import { ProductCategoryPivotEntity } from '../product_category_pivot/product_category_pivot.entity';
import { UserEntity } from '../user/user.entity';
import { ProductVariantEntity } from '../product_variant/product_variant.entity';

@Entity('product')
export class ProductEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({ name: 'default_unit_uuid', type: 'uuid', nullable: true })
  defaultUnitUuid?: string;

  @Column({ name: 'default_price_uuid', type: 'uuid', nullable: true })
  defaultPriceUuid?: string;

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

  @OneToMany(() => ProductUnitEntity, (unit) => unit.product)
  units: ProductUnitEntity[];

  @OneToMany(() => ProductPriceEntity, (price) => price.product)
  price: ProductPriceEntity[];

  @OneToMany(() => ProductVariantEntity, (shelve) => shelve.product)
  shelve: ProductVariantEntity[];

  @OneToMany(() => ProductCategoryPivotEntity, (category) => category.product)
  productCategory: ProductCategoryPivotEntity[];

  @OneToMany(() => ProductVariantEntity, (variant) => variant.product)
  variants: ProductVariantEntity[];
}
