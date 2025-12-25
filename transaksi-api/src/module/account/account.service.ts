import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountEntity, AccountCategory } from 'src/common/entities/account/account.entity';

const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

@Injectable()
export class AccountService {
    constructor(
        @Inject('ACCOUNT_REPOSITORY')
        private accountRepository: Repository<AccountEntity>,
    ) { }

    // Dipanggil saat Install Store / Create Branch
    async initializeStandardAccounts(storeUuid: string) {
        const defaults = [
            // ASSETS (Harta) - Kepala 1
            { code: '1-1001', name: 'Kas Tunai', category: AccountCategory.ASSET, normal: 'DEBIT' },
            { code: '1-1002', name: 'Bank BCA', category: AccountCategory.ASSET, normal: 'DEBIT' },
            { code: '1-2001', name: 'Piutang Usaha', category: AccountCategory.ASSET, normal: 'DEBIT' },

            // LIABILITIES (Kewajiban) - Kepala 2
            { code: '2-1001', name: 'Hutang Usaha', category: AccountCategory.LIABILITY, normal: 'CREDIT' },

            // EQUITY (Modal) - Kepala 3
            { code: '3-1001', name: 'Modal Pemilik', category: AccountCategory.EQUITY, normal: 'CREDIT' },

            // REVENUE (Pendapatan) - Kepala 4
            { code: '4-1001', name: 'Pendapatan Penjualan', category: AccountCategory.REVENUE, normal: 'CREDIT' },
            { code: '4-2001', name: 'Pendapatan Lain-lain', category: AccountCategory.REVENUE, normal: 'CREDIT' },

            // EXPENSE (Beban) - Kepala 6
            { code: '6-1001', name: 'Beban Pembelian Stok', category: AccountCategory.EXPENSE, normal: 'DEBIT' },
            { code: '6-2001', name: 'Beban Operasional', category: AccountCategory.EXPENSE, normal: 'DEBIT' },
            { code: '6-2002', name: 'Beban Gaji', category: AccountCategory.EXPENSE, normal: 'DEBIT' },
        ];

        const entities = defaults.map(d => this.accountRepository.create({
            uuid: `${storeUuid}-ACC-${generateLocalUuid()}-${d.code}`,
            storeUuid,
            code: d.code,
            name: d.name,
            category: d.category,
            normalBalance: d.normal as 'DEBIT' | 'CREDIT',
            isSystem: true
        }));

        await this.accountRepository.save(entities);
    }

    async getAllAccounts(storeUuid: string) {
        return this.accountRepository.find({
            where: { storeUuid },
            order: { code: 'ASC' }
        });
    }
}