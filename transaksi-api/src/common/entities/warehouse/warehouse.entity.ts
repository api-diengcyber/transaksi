import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { ShelveEntity } from '../shelve/shelve.entity';

@Entity('warehouse')
export class WarehouseEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @OneToMany(() => ShelveEntity, (shelve) => shelve.warehouse)
  shelves: ShelveEntity[];

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