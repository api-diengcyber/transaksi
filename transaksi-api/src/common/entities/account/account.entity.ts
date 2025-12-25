import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { StoreEntity } from '../store/store.entity';

export enum AccountCategory {
    ASSET = 'ASSET',         // Harta (Kas, Bank, Inventaris)
    LIABILITY = 'LIABILITY', // Kewajiban (Hutang)
    EQUITY = 'EQUITY',       // Modal
    REVENUE = 'REVENUE',     // Pendapatan
    EXPENSE = 'EXPENSE',     // Pengeluaran/Beban
}

@Entity('account')
export class AccountEntity {
    @PrimaryColumn('varchar', { length: 60 })
    uuid: string;

    @Column({ name: 'store_uuid', type: 'varchar', length: 60 })
    storeUuid: string;

    @Column({ length: 20 })
    code: string; // Contoh: '1-1001', '4-0001'

    @Column({ length: 100 })
    name: string; // Contoh: 'Kas Besar', 'Pendapatan Jasa'

    @Column({
        type: 'enum',
        enum: AccountCategory,
    })
    category: AccountCategory;

    @Column({ name: 'normal_balance', type: 'varchar', length: 10 })
    normalBalance: 'DEBIT' | 'CREDIT';

    @Column({ name: 'is_system', default: false })
    isSystem: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @ManyToOne(() => StoreEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'store_uuid' })
    store: StoreEntity;
}