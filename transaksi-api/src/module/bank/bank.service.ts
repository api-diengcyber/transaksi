import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager, Like, Repository } from 'typeorm';
import { BankEntity } from '../../common/entities/bank/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { generateBankUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class BankService {
  constructor(
    @Inject('BANK_REPOSITORY')
    private bankRepository: Repository<BankEntity>,
  ) { }

  async findAll(storeUuid: string) {
    return this.bankRepository.find({
      where: { 
        uuid: Like(`${storeUuid}%`),
        // is_active: true 
      },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(uuid: string, storeUuid: string) {
    const bank = await this.bankRepository.findOne({
      where: { uuid },
    });
    if (!bank) throw new NotFoundException('Bank tidak ditemukan atau akses ditolak');
    return bank;
  }

  async create(data: CreateBankDto, storeUuid: string) {
    const bank = this.bankRepository.create({
      ...data,
      uuid: generateBankUuid(storeUuid),
      is_active: true
    });
    return this.bankRepository.save(bank);
  }

  async update(uuid: string, data: UpdateBankDto, storeId: string) {
    const existingBank = await this.findOne(uuid, storeId);
    const updatedBank = this.bankRepository.merge(existingBank, data);
    return this.bankRepository.save(updatedBank);
  }

  async delete(uuid: string, storeId: string) {
    const bank = await this.findOne(uuid, storeId);
    return this.bankRepository.remove(bank);
  }

  async createDefaults(storeUuid: string, manager: EntityManager) {
    const defaultBanks = [
      { bank_name: 'Bank BCA', bank_code: 'BCA' },
      { bank_name: 'Bank Mandiri', bank_code: 'MANDIRI' },
      { bank_name: 'Bank BNI', bank_code: 'BNI' },
      { bank_name: 'Bank BRI', bank_code: 'BRI' },
      { bank_name: 'Bank Syariah Indonesia (BSI)', bank_code: 'BSI' }
    ];
    const createdBanks: any[] = [];
    for (const b of defaultBanks) {
      const newBank = manager.create(BankEntity, {
        uuid: generateBankUuid(storeUuid),
        bank_name: b.bank_name,
        bank_code: b.bank_code,
        account_number: '', 
        account_holder: '', 
        is_active: true 
      });
      const savedBank = await manager.save(BankEntity, newBank);
      createdBanks.push(savedBank);
    }
    return createdBanks;
  }
}