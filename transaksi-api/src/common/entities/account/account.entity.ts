import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
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
    code: string; 

    @Column({ length: 100 })
    name: string; 

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

    @Column({ name: 'parent_uuid', nullable: true, length: 60 })
    parentUuid: string;

    @ManyToOne(() => AccountEntity, (account) => account.children, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'parent_uuid' })
    parent: AccountEntity;

    @OneToMany(() => AccountEntity, (account) => account.parent)
    children: AccountEntity[];
}