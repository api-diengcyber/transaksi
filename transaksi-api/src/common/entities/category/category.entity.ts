import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToMany,
    ManyToOne,
} from 'typeorm';
import { ProductCategoryEntity } from '../product_category/product_category.entity';

@Entity('category')
export class CategoryEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

    @Column({ length: 500 })
    name: string;

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

    @ManyToOne(() => CategoryEntity, (cat) => cat.children, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    parent: CategoryEntity | null;

    @OneToMany(() => CategoryEntity, (cat) => cat.parent)
    children: CategoryEntity[];

    @OneToMany(() => ProductCategoryEntity, (ps) => ps.category)
    productCategorys: ProductCategoryEntity[];

    // [NEW] Property virtual untuk menampung jumlah item (tidak masuk database)
    totalItems?: number;
}
