// src/common/entities/bank/bank.entity.ts
import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('banks')
export class BankEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column()
  bank_name: string; // Contoh: BCA, Mandiri, BNI

  // [BARU] Penambahan kode per id bank/rekening
  @Column({ nullable: true, length: 50 })
  bank_code: string; // Contoh: bca, bni, mandiri

  @Column()
  account_number: string; // Nomor Rekening

  @Column()
  account_holder: string; // Nama Pemilik Rekening

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}