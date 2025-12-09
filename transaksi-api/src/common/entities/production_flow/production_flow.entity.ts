import {
    Entity,
    Column,
    PrimaryColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { ProductionEntity } from '../production/production.entity';
import { ProductionFlowUserEntity } from '../production_flow_user/production_flow_user.entity';
import { ProductEntity } from '../product/product.entity'; //

@Entity('production_flow')
export class ProductionFlowEntity {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column({ name: 'production_uuid', type: 'varchar', length: 60 })
    productionUuid: string;

    @ManyToOne(() => ProductionEntity, production => production.flows)
    @JoinColumn({ name: 'production_uuid' })
    production: ProductionEntity;

    @Column({ name: 'product_uuid', type: 'varchar', length: 60, nullable: true })
    productUuid?: string;

    @Column({ name: 'step_order', type: 'int' })
    stepOrder: number;

    @Column({ length: 500 })
    stepName: string;

    @OneToMany(() => ProductionFlowUserEntity, worker => worker.productionFlow, { cascade: true })
    workers: ProductionFlowUserEntity[];

    @Column({ name: 'is_completed', type: 'boolean', default: false })
    isCompleted: boolean;

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt?: Date;

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

    @ManyToOne(() => ProductEntity)
    @JoinColumn({ name: 'product_uuid' })
    product?: ProductEntity;

}