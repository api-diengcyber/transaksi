import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Courier } from '../courier/courier.entity';

@Entity('courier_routes')
export class CourierRoute {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column()
    courier_uuid: string;

    @Column()
    origin: string;

    @Column()
    destination: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    price: number;

    @Column({ default: true })
    is_active: boolean;

    @Column({ nullable: true })
    store_id: string;

    @ManyToOne(() => Courier)
    @JoinColumn({ name: 'courier_uuid' })
    courier: Courier;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}