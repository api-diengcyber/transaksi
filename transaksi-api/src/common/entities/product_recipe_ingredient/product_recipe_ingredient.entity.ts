import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { ProductUnitEntity } from '../product_unit/product_unit.entity';

@Entity('product_recipe_ingredient')
@Unique(['recipeProductUuid', 'ingredientProductUuid', 'unitUuid'])
export class ProductRecipeIngredientEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'recipe_product_uuid', type: 'varchar', length: 60 })
  recipeProductUuid: string; // Produk Jadi (Menu)

  @Column({ name: 'ingredient_product_uuid', type: 'varchar', length: 60 })
  ingredientProductUuid: string; // Produk Bahan Baku

  @Column({ name: 'unit_uuid', type: 'uuid' })
  unitUuid: string; // Satuan dari Bahan Baku (UnitEntity)

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  qty: number; // Jumlah Bahan Baku yang dibutuhkan per 1 unit Produk Jadi

  // --- RELATIONS ---

  // Relasi ke Produk Jadi (Recipe)
  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_product_uuid' })
  recipeProduct: ProductEntity;

  // Relasi ke Produk Bahan Baku (Ingredient)
  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' }) // Biasanya RESTRICT agar bahan baku tidak bisa dihapus jika masih digunakan
  @JoinColumn({ name: 'ingredient_product_uuid' })
  ingredientProduct: ProductEntity;

  // Relasi ke Satuan Bahan Baku
  @ManyToOne(() => ProductUnitEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_uuid' })
  unit: ProductUnitEntity;

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
}