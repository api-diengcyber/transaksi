// src/common/entities/payment_method/payment_method.entity.ts
import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BankEntity } from '../bank/bank.entity';

@Entity('payment_methods')
export class PaymentMethodEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column()
  name: string; // Contoh: Transfer BCA, QRIS, GoPay

  @Column()
  category: string; // BANK, EWALLET, RETAIL, QRIS, CASH

  @Column({ unique: true })
  code: string; // bca_transfer, qris, gopay

  @Column({ default: false })
  is_active: boolean;

  @Column({ nullable: true })
  image_url: string;
  
  @Column({ type: 'int', default: 0 })
  urutan: number;

  @Column({ nullable: true })
  bank_id: string | null;

  @ManyToOne(() => BankEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bank_id' })
  bank: BankEntity;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}