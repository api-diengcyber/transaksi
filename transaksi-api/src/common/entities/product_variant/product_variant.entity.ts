import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { ProductEntity } from "../product/product.entity";
import { ProductUnitEntity } from "../product_unit/product_unit.entity";

@Entity('product_variant')
export class ProductVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'product_uuid', type: 'uuid' })
  productUuid: string;

  @ManyToOne(() => ProductEntity, (product) => product.variants)
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @OneToMany(() => ProductUnitEntity, (unit) => unit.variant)
  units: ProductUnitEntity[];
}