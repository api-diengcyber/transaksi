import { Entity, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, PrimaryColumn } from 'typeorm';

@Entity('promo')
export class PromoEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  // 'PRODUCT' atau 'MEMBER'
  @Column({ type: 'varchar', length: 20 })
  promo_type: string; 

  // 'PERCENTAGE' atau 'FIXED'
  @Column({ type: 'varchar', length: 20, default: 'PERCENTAGE' })
  discount_type: string;

  @Column('decimal', { precision: 10, scale: 2 })
  discount_value: number;

  // Bisa berisi Product UUID atau Member/Tier UUID
  @Column({ nullable: true })
  target_uuid: string; 

  @Column({ type: 'date', nullable: true })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}