import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountEntity, AccountCategory } from 'src/common/entities/account/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

@Injectable()
export class AccountService {
    constructor(
        @Inject('ACCOUNT_REPOSITORY')
        private accountRepository: Repository<AccountEntity>,
    ) { }
    
    getAccountCategories() {
        return [
            { value: AccountCategory.ASSET, label: 'Harta (ASSET)' },
            { value: AccountCategory.LIABILITY, label: 'Kewajiban (LIABILITY)' },
            { value: AccountCategory.EQUITY, label: 'Modal (EQUITY)' },
            { value: AccountCategory.REVENUE, label: 'Pendapatan (REVENUE)' },
            { value: AccountCategory.EXPENSE, label: 'Beban (EXPENSE)' },
        ];
    }

    async initializeStandardAccounts(storeUuid: string) {
        // ... (kode inisialisasi yang sudah ada biarkan saja) ...
        const defaults = [
            { code: '1-1001', name: 'Kas Tunai', category: AccountCategory.ASSET, normal: 'DEBIT' },
            { code: '1-1002', name: 'Bank BCA', category: AccountCategory.ASSET, normal: 'DEBIT' },
            { code: '1-2001', name: 'Piutang Usaha', category: AccountCategory.ASSET, normal: 'DEBIT' },
            { code: '2-1001', name: 'Hutang Usaha', category: AccountCategory.LIABILITY, normal: 'CREDIT' },
            { code: '3-1001', name: 'Modal Pemilik', category: AccountCategory.EQUITY, normal: 'CREDIT' },
            { code: '4-1001', name: 'Pendapatan Penjualan', category: AccountCategory.REVENUE, normal: 'CREDIT' },
            { code: '4-2001', name: 'Pendapatan Lain-lain', category: AccountCategory.REVENUE, normal: 'CREDIT' },
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

    // --- TAMBAHAN FITUR BARU (CRUD) ---

    async create(storeUuid: string, dto: CreateAccountDto) {
    const exist = await this.accountRepository.findOne({
        where: { storeUuid, code: dto.code }
    });
    if (exist) throw new BadRequestException(`Kode akun ${dto.code} sudah digunakan.`);

    const newAccount = this.accountRepository.create({
        uuid: `${storeUuid}-ACC-${generateLocalUuid()}-${dto.code}`,
        storeUuid,
        ...dto,
        parentUuid: dto.parentUuid || null, // Pastikan tersimpan
        isSystem: false
    });

    return this.accountRepository.save(newAccount);
}

    // 2. Ambil satu akun
    async findOne(storeUuid: string, uuid: string) {
        const account = await this.accountRepository.findOne({
            where: { storeUuid, uuid }
        });
        if (!account) throw new NotFoundException('Akun tidak ditemukan');
        return account;
    }


    // Update method update
    async update(storeUuid: string, uuid: string, dto: UpdateAccountDto) {
        const account = await this.findOne(storeUuid, uuid);

        if (dto.code && dto.code !== account.code) {
            const exist = await this.accountRepository.findOne({
                where: { storeUuid, code: dto.code }
            });
            if (exist) throw new BadRequestException(`Kode akun ${dto.code} sudah digunakan.`);
        }
        
        // Cegah akun menjadi parent bagi dirinya sendiri
        if (dto.parentUuid && dto.parentUuid === uuid) {
            throw new BadRequestException('Akun tidak bisa menjadi parent bagi dirinya sendiri.');
        }

        Object.assign(account, dto);
        // Pastikan jika parentUuid dikirim null/undefined dihandle dengan benar jika ingin menghapus relasi
        if (dto.parentUuid === null) account.parentUuid = null;

        return this.accountRepository.save(account);
    }

    // 4. Hapus Akun
    async remove(storeUuid: string, uuid: string) {
        const account = await this.findOne(storeUuid, uuid);

        if (account.isSystem) {
            throw new BadRequestException('Akun bawaan sistem tidak dapat dihapus.');
        }

        // Opsional: Cek apakah akun sudah dipakai di Jurnal sebelum dihapus
        // logic ini butuh inject JournalRepository, bisa ditambahkan nanti.

        return this.accountRepository.remove(account);
    }
}