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
import { UserEntity } from '../user/user.entity';

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

    @ManyToOne(() => CategoryEntity, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'category_uuid' })
    category: CategoryEntity;

    @Column({ name: 'category_uuid', type: 'uuid', nullable: true })
    categoryUuid?: string;

    @ManyToOne(() => ProductEntity, (product) => product.productCategory, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'product_uuid' })
    product: ProductEntity;

    @Column({ name: 'product_uuid', type: 'uuid' })
    productUuid: string;
}