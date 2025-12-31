import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  OCCUPIED = 'OCCUPIED',
}

@Entity('table')
export class TableEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'int', default: 2 })
  capacity: number;

  @Column({
    type: 'enum',
    enum: TableStatus,
    default: TableStatus.AVAILABLE,
  })
  status: TableStatus;

  // Kolom Booking dihapus sesuai permintaan
  // Data booking akan masuk history di Journal

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