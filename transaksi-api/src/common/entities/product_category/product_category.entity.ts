import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    JoinColumn,
    ManyToOne,
} from 'typeorm';
import { ProductEntity } from '../product/product.entity';
import { CategoryEntity } from '../category/category.entity';

@Entity('product_category')
export class ProductCategoryEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

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

    @ManyToOne(() => CategoryEntity, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'category_uuid' })
    category: CategoryEntity;

    @Column({ name: 'category_uuid', type: 'uuid', nullable: true })
    categoryUuid?: string;

    @ManyToOne(() => ProductEntity, (product) => product.category, { // Pastikan relasi di ProductEntity bernama 'category'
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'product_uuid' })
    product: ProductEntity;

    @Column({ name: 'product_uuid', type: 'uuid' })
    productUuid: string;
}