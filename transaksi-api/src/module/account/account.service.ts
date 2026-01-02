import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountEntity, AccountCategory } from 'src/common/entities/account/account.entity';
import { JournalConfigEntity } from 'src/common/entities/journal_config/journal_config.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';
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

        // 1. Ambil semua akun milik store
        const accounts = await this.accountRepository.find({
            where: { storeUuid },
            order: { code: 'ASC' }
        });

        // 2. Ambil konfigurasi jurnal
        const configs = await this.accountRepository.manager.find(JournalConfigEntity, {
            where: { storeUuid }
        });

        // SORTING PENTING:
        // Urutkan config agar yang spesifik (bukan wildcard) dicek duluan,
        // dan wildcard yang lebih panjang dicek sebelum yang pendek.
        configs.sort((a, b) => {
            const aIsWild = a.detailKey.endsWith('_');
            const bIsWild = b.detailKey.endsWith('_');
            if (!aIsWild && bIsWild) return -1;
            if (aIsWild && !bIsWild) return 1;
            return b.detailKey.length - a.detailKey.length;
        });

        // 3. Ambil detail jurnal
        // Menggunakan filter LIKE di SQL hanya sebagai penyaring kasar (pre-filter)
        const details = await this.accountRepository.manager.createQueryBuilder(JournalDetailEntity, 'jd')
            .leftJoinAndSelect('jd.journal', 'j')
            .where('j.created_at BETWEEN :start AND :end', { start, end })
            // Pastikan ada hyphen di depan dan belakang UUID untuk mengurangi resiko match partial
            .andWhere('j.code LIKE :storePattern', { storePattern: `%-${storeUuid}-%` })
            .getMany();

        // 4. Inisialisasi Map Saldo
        const balanceMap: Record<string, { debit: number, credit: number }> = {};
        accounts.forEach(acc => {
            balanceMap[acc.uuid] = { debit: 0, credit: 0 };
        });

        // 5. Proses Perhitungan
        for (const detail of details) {
            if (!detail.journal || !detail.value) continue;

            const journalCode = detail.journal.code;
            const parts = journalCode.split('-');
            
            // --- FIX UTAMA: VALIDASI STRICT UUID ---
            // Asumsi format kode: TYPE-STORE_UUID-DATE-SEQ 
            // parts[0] = TYPE, parts[1] = STORE_UUID
            // Kita cek apakah parts[1] benar-benar SAMA PERSIS dengan storeUuid yang diminta
            if (parts.length < 2 || parts[1] !== storeUuid) {
                continue; // Skip jika UUID di kode tidak sama persis (korban partial match SQL)
            }

            const type = parts[0]; 

            // Cari config yang cocok
            const config = configs.find(c => {
                if (c.transactionType !== type) return false;

                if (c.detailKey.endsWith('_')) {
                    return detail.key.startsWith(c.detailKey);
                } else {
                    return detail.key === c.detailKey;
                }
            });

            // Jika config ditemukan, hitung saldo
            if (config && balanceMap[config.accountUuid]) {
                const val = Number(detail.value) || 0;
                
                if (config.position === 'DEBIT') {
                    balanceMap[config.accountUuid].debit += val;
                } else if (config.position === 'CREDIT') {
                    balanceMap[config.accountUuid].credit += val;
                }
            }
        }

        // 6. Format hasil akhir
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