import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductStockEntity } from '../product_stock/product_stock.entity';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';
import { ProductPriceEntity } from '../product_price/product_price.entity';

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

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string;

  @OneToMany(() => ProductUnitEntity, (unit) => unit.product)
  units: ProductUnitEntity[];

  @OneToMany(() => ProductStockEntity, (stock) => stock.product)
  stock: ProductStockEntity[];

  @OneToMany(() => ProductPriceEntity, (price) => price.product)
  price: ProductPriceEntity[];
}
