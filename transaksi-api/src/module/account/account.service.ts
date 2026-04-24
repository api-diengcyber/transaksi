import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AccountEntity, AccountCategory } from 'src/common/entities/account/account.entity';
import { JournalConfigEntity } from 'src/common/entities/journal_config/journal_config.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { generateAccountUuid, generateLocalUuid } from 'src/common/utils/generate_uuid_util';

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
    
    async createDefaultAccounts(storeUuid: string, manager: EntityManager) {
        const defaultAccounts: Partial<AccountEntity>[] = [
            // --- ASSET (HARTA) ---
            { code: '1001', name: 'Kas Tunai / Laci', category: AccountCategory.ASSET, normalBalance: 'DEBIT', isSystem: true },
            { code: '1002', name: 'Kas Bank / Transfer', category: AccountCategory.ASSET, normalBalance: 'DEBIT', isSystem: true },
            { code: '1101', name: 'Piutang Usaha (AR)', category: AccountCategory.ASSET, normalBalance: 'DEBIT', isSystem: true },
            { code: '1201', name: 'Persediaan Barang Dagang', category: AccountCategory.ASSET, normalBalance: 'DEBIT', isSystem: true },

            // --- LIABILITY (KEWAJIBAN/HUTANG) ---
            { code: '2001', name: 'Hutang Usaha (AP)', category: AccountCategory.LIABILITY, normalBalance: 'CREDIT', isSystem: true },
            { code: '2101', name: 'Hutang PPN (Keluaran)', category: AccountCategory.LIABILITY, normalBalance: 'CREDIT', isSystem: true },

            // --- EQUITY (MODAL) ---
            { code: '3001', name: 'Modal Awal Pemilik', category: AccountCategory.EQUITY, normalBalance: 'CREDIT', isSystem: true },
            { code: '3999', name: 'Laba Ditahan', category: AccountCategory.EQUITY, normalBalance: 'CREDIT', isSystem: true },

            // --- REVENUE (PENDAPATAN) ---
            { code: '4001', name: 'Pendapatan Penjualan', category: AccountCategory.REVENUE, normalBalance: 'CREDIT', isSystem: true },
            { code: '4002', name: 'Retur Penjualan', category: AccountCategory.REVENUE, normalBalance: 'DEBIT', isSystem: true }, // Kontra Revenue

            // --- EXPENSE (BEBAN/BIAYA) ---
            { code: '5001', name: 'Harga Pokok Penjualan (HPP)', category: AccountCategory.EXPENSE, normalBalance: 'DEBIT', isSystem: true },
            { code: '5002', name: 'Retur Pembelian', category: AccountCategory.EXPENSE, normalBalance: 'CREDIT', isSystem: true }, // Kontra Expense/HPP
            { code: '6001', name: 'Biaya Operasional Umum', category: AccountCategory.EXPENSE, normalBalance: 'DEBIT', isSystem: false },
        ];

        for (const acc of defaultAccounts) {
            const newAccount = manager.create(AccountEntity, {
                uuid: generateAccountUuid(storeUuid),
                storeUuid: storeUuid,
                code: acc.code,
                name: acc.name,
                category: acc.category,
                normalBalance: acc.normalBalance,
                isSystem: acc.isSystem,
            });
            await manager.save(AccountEntity, newAccount);
        }
    }

    async getAllAccounts(storeUuid: string) {
        return this.accountRepository.find({
            where: { storeUuid },
            order: { code: 'ASC' }
        });
    }

    async create(storeUuid: string, dto: CreateAccountDto) {
        const exist = await this.accountRepository.findOne({
            where: { storeUuid, code: dto.code }
        });
        if (exist) throw new BadRequestException(`Kode akun ${dto.code} sudah digunakan.`);

        const newAccount = this.accountRepository.create({
            uuid: `${storeUuid}-ACC-${generateLocalUuid()}-${dto.code}`,
            storeUuid,
            ...dto,
            parentUuid: dto.parentUuid || null, 
            isSystem: false
        });

        return this.accountRepository.save(newAccount);
    }

    async findOne(storeUuid: string, uuid: string) {
        const account = await this.accountRepository.findOne({
            where: { storeUuid, uuid }
        });
        if (!account) throw new NotFoundException('Akun tidak ditemukan');
        return account;
    }

    private async propagateCategoryChange(storeUuid: string, parentUuid: string, newCategory: AccountCategory) {
        // 1. Ambil semua anak langsung (direct children)
        const children = await this.accountRepository.find({
            where: { storeUuid, parentUuid }
        });

        if (children.length === 0) return;

        // 2. Update kategori anak-anak ini di Database
        await this.accountRepository.update(
            { storeUuid, parentUuid }, 
            { category: newCategory }
        );

        // 3. Rekursif: Lakukan hal yang sama untuk cucu-cucu dst.
        for (const child of children) {
            await this.propagateCategoryChange(storeUuid, child.uuid, newCategory);
        }
    }

    // Perbaikan method update
    async update(storeUuid: string, uuid: string, dto: UpdateAccountDto) {
        // Ambil data lama sebelum diubah
        const account = await this.findOne(storeUuid, uuid);
        const oldCategory = account.category; 

        // 1. Validasi Kode Unik (jika kode berubah)
        if (dto.code && dto.code !== account.code) {
            const exist = await this.accountRepository.findOne({
                where: { storeUuid, code: dto.code }
            });
            if (exist) throw new BadRequestException(`Kode akun ${dto.code} sudah digunakan.`);
        }
        
        // 2. Validasi: Tidak boleh menjadi parent bagi diri sendiri
        if (dto.parentUuid && dto.parentUuid === uuid) {
            throw new BadRequestException('Akun tidak bisa menjadi parent bagi dirinya sendiri.');
        }

        // 3. Terapkan perubahan dari DTO ke object account
        Object.assign(account, dto);
        
        // Handle khusus jika parentUuid diset NULL (jadi root)
        if (dto.parentUuid === null) {
            account.parentUuid = null;
        }

        // 4. Logika Sinkronisasi Kategori dengan Parent
        // Jika parentUuid ada isinya (bukan null) dan kita sedang memindah parent
        // Maka Kategori Akun WAJIB mengikuti Kategori Parent Baru
        if (account.parentUuid) {
            // Kita fetch parent baru untuk mengambil kategorinya
            const newParent = await this.findOne(storeUuid, account.parentUuid);
            
            // Override kategori akun ini agar sama dengan parent
            account.category = newParent.category;
        }

        // 5. Simpan perubahan akun utama
        const savedAccount = await this.accountRepository.save(account);

        // 6. Cek apakah Kategori Berubah?
        // (Bisa karena pindah parent, atau user manual ganti kategori di root)
        if (savedAccount.category !== oldCategory) {
            // Jika berubah, update semua sub-akun (anak/cucu) agar seragam
            await this.propagateCategoryChange(storeUuid, savedAccount.uuid, savedAccount.category);
        }

        return savedAccount;
    }

    async remove(storeUuid: string, uuid: string) {
        const account = await this.findOne(storeUuid, uuid);

        if (account.isSystem) {
            throw new BadRequestException('Akun bawaan sistem tidak dapat dihapus.');
        }

        return this.accountRepository.remove(account);
    }

    async getFinancialReport(storeUuid: string, startDate: string, endDate: string) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // 1. Ambil Akun & Config
        const accounts = await this.accountRepository.find({
            where: { storeUuid },
            order: { code: 'ASC' }
        });

        // Ambil SEMUA config (jangan di-sort/filter dulu disini)
        const configs = await this.accountRepository.manager.find(JournalConfigEntity, {
            where: { storeUuid }
        });

        // 2. Query Journal Detail
        const details = await this.accountRepository.manager.createQueryBuilder(JournalDetailEntity, 'jd')
            .leftJoinAndSelect('jd.journal', 'j')
            .where('j.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('j.code LIKE :storePattern', { storePattern: `%-${storeUuid}-%` }) 
            .getMany();

        // 3. Inisialisasi Map Saldo
        const balanceMap: Record<string, { debit: number, credit: number }> = {};
        accounts.forEach(acc => {
            balanceMap[acc.uuid] = { debit: 0, credit: 0 };
        });

        // 4. Proses Loop Data
        for (const detail of details) {
            // Validasi Value
            let val = 0;
            if (typeof detail.value === 'string') {
                val = parseFloat(detail.value) || 0;
            } else {
                val = Number(detail.value) || 0;
            }

            if (!detail.journal || val === 0) continue;

            // Parsing Type
            const journalCode = detail.journal.code;
            const type = journalCode.split('-')[0]; 

            // --- LOGIKA PENCARIAN CONFIG (DIPERBAIKI) ---
            
            let targetConfigs: JournalConfigEntity[] = [];

            // A. Coba cari EXACT MATCH dulu (Prioritas Tertinggi)
            // Kita cari semua config yang transactionType & detailKey-nya persis sama
            const exactMatches = configs.filter(c => 
                (c.transactionType === type || c.transactionType.split('-')[0] === "MANUAL") && 
                c.detailKey === detail.key
            );

            console.log("exactMatches: " + type);

            if (exactMatches.length > 0) {
                targetConfigs = exactMatches;
            } else {
                // B. Jika tidak ada Exact, cari WILDCARD MATCH
                const wildcardMatches = configs.filter(c => 
                    c.transactionType === type && 
                    c.detailKey.endsWith('_') && 
                    detail.key.startsWith(c.detailKey)
                );

                if (wildcardMatches.length > 0) {
                    // Masalah: Bisa ada wildcard "SALE_" dan "SALE_A_" yang match "SALE_A_1".
                    // Kita harus ambil yang PALING SPESIFIK (paling panjang kuncinya).
                    
                    // 1. Urutkan berdasarkan panjang key descending (terpanjang di atas)
                    wildcardMatches.sort((a, b) => b.detailKey.length - a.detailKey.length);
                    
                    // 2. Ambil key terbaik (yang paling atas)
                    const bestKey = wildcardMatches[0].detailKey;

                    // 3. Ambil SEMUA config yang punya key terbaik tersebut (untuk support split journal)
                    targetConfigs = wildcardMatches.filter(c => c.detailKey === bestKey);
                }
            }

            // --- AKHIR LOGIKA PENCARIAN ---

            // C. Loop semua config yang ditemukan dan update saldo
            for (const config of targetConfigs) {
                if (balanceMap[config.accountUuid]) {
                    if (config.position === 'DEBIT') {
                        balanceMap[config.accountUuid].debit += val;
                    } else if (config.position === 'CREDIT') {
                        balanceMap[config.accountUuid].credit += val;
                    }
                }
            }
        }

        // 5. Hitung Saldo Akhir
        const report = accounts.map(acc => {
            const bal = balanceMap[acc.uuid];
            
            let finalBalance = 0;
            if (acc.normalBalance === 'DEBIT') {
                finalBalance = bal.debit - bal.credit;
            } else {
                finalBalance = bal.credit - bal.debit;
            }

            return {
                uuid: acc.uuid,
                code: acc.code,
                name: acc.name,
                category: acc.category,
                normalBalance: acc.normalBalance,
                debit: bal.debit,
                credit: bal.credit,
                balance: finalBalance
            };
        });

        return report;
    }
}