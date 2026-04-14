// src/module/payment_method/payment_method.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { BankEntity } from 'src/common/entities/bank/bank.entity';
import { PaymentMethodEntity } from 'src/common/entities/payment_method/payment_method.entity';
import { generatePaymentMethodUuid } from 'src/common/utils/generate_uuid_util';
import { EntityManager, Like, Repository } from 'typeorm';

@Injectable()
export class PaymentMethodService {
  constructor(
    @Inject('PAYMENT_METHOD_REPOSITORY')
    private repository: Repository<PaymentMethodEntity>,
  ) {}

  async findAllByStore(storeUuid: string) {
    return await this.repository.find({ 
      where: { 
				uuid: Like(`${storeUuid}%`),
			},
      relations: ['bank'], 
			order: { urutan: 'ASC', category: 'ASC', name: 'ASC' },
    });
  }

  // 2. Update data (terutama untuk menautkan bank_id)
  async update(uuid: string, data: any, storeUuid: string) {
    const payment = await this.repository.findOneBy({ uuid });
    
    if (!payment) {
      throw new NotFoundException('Metode pembayaran tidak ditemukan');
    }

    // Jika user mengupdate untuk menautkan rekening bank (misal data berisi bank_id)
    if (data.bank_id !== undefined) {
      payment.bank_id = data.bank_id === '' ? null : data.bank_id;
    }
    
    if (data.name !== undefined) payment.name = data.name;
    if (data.is_active !== undefined) payment.is_active = data.is_active;

    await this.repository.save(payment);
    return await this.repository.findOne({ where: { uuid }, relations: ['bank'] });
  }

  // 3. Toggle Status Cepat
  async toggleStatus(uuid: string, isActive: boolean, storeUuid: string) {
    const payment = await this.repository.findOneBy({ uuid });
    if (!payment) throw new NotFoundException('Metode pembayaran tidak ditemukan');

    await this.repository.update(uuid, { is_active: isActive });
    return { success: true };
  }

  async createDefaults(storeUuid: string, createdBanks: BankEntity[], manager: EntityManager) {
      const getBankId = (code: string) => {
         const bank = createdBanks.find(b => b.bank_code === code);
         return bank ? bank.uuid : null;
      };

      const defaultPaymentMethods = [
        { name: 'Tunai / Kas', category: 'CASH', code: 'cash_tunai', is_active: true, bank_id: null, urutan: 1 },
        { name: 'QRIS', category: 'QRIS', code: 'qris_all', is_active: false, bank_id: null, urutan: 2 },
        { name: 'GoPay', category: 'EWALLET', code: 'ewallet_gopay', is_active: false, bank_id: null, urutan: 3 },
        { name: 'OVO', category: 'EWALLET', code: 'ewallet_ovo', is_active: false, bank_id: null, urutan: 4 },
        { name: 'Transfer Bank BCA', category: 'BANK', code: 'transfer_bca', is_active: false, bank_id: getBankId('BCA'), urutan: 5 },
        { name: 'Transfer Bank Mandiri', category: 'BANK', code: 'transfer_mandiri', is_active: false, bank_id: getBankId('MANDIRI'), urutan: 6 },
      ];

      for (const pm of defaultPaymentMethods) {
				const newMethod = manager.create(PaymentMethodEntity, {
					uuid: generatePaymentMethodUuid(storeUuid),
					name: pm.name,
					category: pm.category,
					code: pm.code,
					urutan: pm.urutan,
					is_active: pm.is_active,
					bank_id: pm.bank_id,
				});
				await manager.save(PaymentMethodEntity, newMethod);
      }
  }
}