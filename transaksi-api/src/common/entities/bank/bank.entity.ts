import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('banks')
export class BankEntity {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column()
  bank_name: string;

  @Column()
  account_number: string;

  @Column()
  account_holder: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  store_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}