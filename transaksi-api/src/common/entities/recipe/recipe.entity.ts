import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { UnitEntity } from '../unit/unit.entity';

@Entity('recipes')
export class RecipeEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'store_uuid' })
  storeUuid: string;

  // UUID Produk Jadi (Contoh: Nasi Goreng)
  @Column({ name: 'product_uuid' })
  productUuid: string;

  // UUID Produk Bahan Baku (Contoh: Beras, Telur)
  // Penamaan di database menggunakan snake_case, tapi di class mengikuti frontend (ingredientProductUuid)
  @Column({ name: 'ingredient_uuid' })
  ingredientProductUuid: string;

  @Column({ name: 'unit_uuid' })
  unitUuid: string;

  @Column('decimal', { precision: 12, scale: 4 })
  qty: number;

  // --- Relations (Opsional, untuk validasi constraint DB) ---
  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_uuid' })
  product: ProductEntity;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'ingredient_uuid' })
  ingredientProduct: ProductEntity;

  @ManyToOne(() => UnitEntity)
  @JoinColumn({ name: 'unit_uuid' })
  unit: UnitEntity;

  // --- Audit ---
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}