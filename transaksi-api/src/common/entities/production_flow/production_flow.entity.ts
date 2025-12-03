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
import { ProductionEntity } from '../production/production.entity'; // Import ProductionEntity

@Entity('production_flow')
export class ProductionFlowEntity {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column({ name: 'production_uuid', type: 'varchar', length: 60 })
    productionUuid: string;

    @ManyToOne(() => ProductionEntity, production => production.flows)
    @JoinColumn({ name: 'production_uuid' })
    production: ProductionEntity;
    
    @Column({ name: 'step_order', type: 'int' })
    stepOrder: number; // Urutan langkah (misal: 1, 2, 3)

    @Column({ length: 500 })
    stepName: string; // Nama langkah (misal: Mixing Adonan, Baking, Packaging)

    @Column({ length: 100, nullable: true })
    pic: string; // Person In Charge / Pegawai yang bertugas di langkah ini

    @Column({ name: 'is_completed', type: 'boolean', default: false })
    isCompleted: boolean; // Status apakah langkah ini sudah selesai

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt?: Date; // Waktu penyelesaian langkah
    
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
}