import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BankEntity } from '../../common/entities/bank/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';

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

  async create(data: CreateBankDto, storeId: string) {
    const bank = this.bankRepository.create({ ...data, store_id: storeId });
    return this.bankRepository.save(bank);
  }

  async delete(id: string) {
    return this.bankRepository.delete(id);
  }
}