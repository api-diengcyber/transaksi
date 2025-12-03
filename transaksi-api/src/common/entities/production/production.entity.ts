
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
import { UserEntity } from '../user/user.entity';
import { ProductionFlowEntity } from '../production_flow/production_flow.entity';

@Entity('production')
export class ProductionEntity {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column({ length: 500, nullable: true })
    name: string;

    @Column({ length: 500, nullable: true })
    notes: string;

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
    
    @OneToMany(() => ProductionFlowEntity, flow => flow.production) 
    flows: ProductionFlowEntity[];
}
