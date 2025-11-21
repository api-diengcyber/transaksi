import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ProductStockEntity } from '../product_stock/product_stock.entity';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';
import { ProductShelveEntity } from '../product_shelve/product_shelve.entity';
import { ProductCategoryEntity } from '../product_category/product_category.entity';
import { UserEntity } from '../user/user.entity';
import { StoreEntity } from '../store/store.entity';

@Entity('product')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
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
  
  @Column({ name: 'store_uuid', type: 'uuid' })
  storeUuid: string;

  @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' }) 
  @JoinColumn({ name: 'store_uuid' })
  store: StoreEntity;

  @OneToMany(() => ProductUnitEntity, (unit) => unit.product)
  units: ProductUnitEntity[];

  @OneToMany(() => ProductStockEntity, (stock) => stock.product)
  stock: ProductStockEntity[];

  @OneToMany(() => ProductPriceEntity, (price) => price.product)
  price: ProductPriceEntity[];

  @OneToMany(() => ProductShelveEntity, (shelve) => shelve.product)
  shelve: ProductShelveEntity[];

  @OneToMany(() => ProductCategoryEntity, (category) => category.product)
  productCategory: ProductCategoryEntity[];
}
