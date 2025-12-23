import { Column, Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('couriers')
export class Courier {
  @PrimaryColumn('varchar', { length: 60 })
  uuid: string;

  @Column()
  name: string; // Contoh: "JNE", "J&T", "SPX"

  @Column({ nullable: true })
  code: string; // Contoh: "jne-reg", "spx-std" (Opsional)

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  store_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}