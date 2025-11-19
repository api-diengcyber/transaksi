import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('shelve')
export class ShelveEntity {
    @PrimaryGeneratedColumn('uuid')
    uuid: string;

    @Column({ length: 500 })
    name: string;

    @Column({ length: 500 })
    description: string;

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
