import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToMany,
    ManyToOne,
} from 'typeorm';
import { ProductCategoryPivotEntity } from '../product_category_pivot/product_category_pivot.entity';

@Entity('product_category')
export class ProductCategoryEntity {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column({ length: 500 })
    name: string;
    
    @Column({ name: 'is_restaurant', type: 'boolean', default: false })
    isRestaurant: boolean;

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

    @ManyToOne(() => ProductCategoryEntity, (cat) => cat.children, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    parent: ProductCategoryEntity | null;

    @OneToMany(() => ProductCategoryEntity, (cat) => cat.parent)
    children: ProductCategoryEntity[];

    @OneToMany(() => ProductCategoryPivotEntity, (ps) => ps.category)
    productCategorys: ProductCategoryPivotEntity[];

    // [NEW] Property virtual untuk menampung jumlah item (tidak masuk database)
    totalItems?: number;
}
