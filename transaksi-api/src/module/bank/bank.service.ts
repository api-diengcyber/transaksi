import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BankEntity } from '../../common/entities/bank/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

// Helper untuk generate ID unik pendek
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

@Injectable()
export class BankService {
  constructor(
    @Inject('BANK_REPOSITORY')
    private bankRepository: Repository<BankEntity>,
  ) { }

  async findAll(storeId: string) {
    return this.bankRepository.find({
      where: { store_id: storeId, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  // Helper untuk mencari satu bank dengan validasi toko
  async findOne(uuid: string, storeId: string) {
    const bank = await this.bankRepository.findOne({
      where: { uuid, store_id: storeId },
    });
    if (!bank) throw new NotFoundException('Bank tidak ditemukan atau akses ditolak');
    return bank;
  }

  async create(data: CreateBankDto, storeId: string) {
    // GENERATE UUID DENGAN PREFIX TOKO
    const customUuid = `${storeId}-${generateLocalUuid()}`;

    const bank = this.bankRepository.create({
      ...data,
      uuid: customUuid, // Set UUID manual
      store_id: storeId,
      is_active: true
    });
    return this.bankRepository.save(bank);
  }

  async update(uuid: string, data: UpdateBankDto, storeId: string) {
    // Pastikan bank ada dan milik toko ini sebelum update
    const existingBank = await this.findOne(uuid, storeId);
    
    // Update data
    const updatedBank = this.bankRepository.merge(existingBank, data);
    return this.bankRepository.save(updatedBank);
  }

  async delete(uuid: string, storeId: string) {
    // Cek dulu apakah data milik toko ini
    const bank = await this.findOne(uuid, storeId);
    return this.bankRepository.remove(bank);
  }
}