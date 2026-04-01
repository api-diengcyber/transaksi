import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WarehouseEntity } from '../warehouse/warehouse.entity';

@Entity('shelve')
export class ShelveEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({ name: 'warehouse_uuid', nullable: true })
  warehouseUuid: string;

  @ManyToOne(() => WarehouseEntity, (warehouse) => warehouse.shelves, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'warehouse_uuid' })
  warehouse: WarehouseEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy?: string;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy?: string;
}