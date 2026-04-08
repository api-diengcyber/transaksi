import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JournalEntity } from 'src/common/entities/journal/journal.entity';
import { JournalDetailEntity } from 'src/common/entities/journal_detail/journal_detail.entity';

@Injectable()
export class DashboardService {
  constructor(@Inject('DATA_SOURCE') private dataSource: DataSource) {}

  async getSummary(storeUuid: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // 1. Omset Hari Ini (Penjualan)
    const saleJournals = await this.dataSource.getRepository(JournalEntity)
      .createQueryBuilder('j')
      .innerJoinAndSelect(JournalDetailEntity, 'jd', "jd.journalCode = j.code AND jd.key = 'grand_total'")
      .where("j.code LIKE 'SALE%'")
      .andWhere("j.uuid LIKE :store", { store: `${storeUuid}%` })
      .andWhere("j.createdAt BETWEEN :start AND :end", { start: startOfDay, end: endOfDay })
      .getRawMany();

    let todayRevenue = 0;
    saleJournals.forEach(j => {
        todayRevenue += Number(j.jd_value || 0);
    });

    const todayTransactions = saleJournals.length;

    // 2. Item Terjual Hari Ini (Total QTY)
    const soldItems = await this.dataSource.getRepository(JournalEntity)
      .createQueryBuilder('j')
      .innerJoinAndSelect(JournalDetailEntity, 'jd', "jd.journalCode = j.code AND (jd.key LIKE 'qty#%' OR jd.key LIKE 'stok_qty_min#%')")
      .where("j.code LIKE 'SALE%'")
      .andWhere("j.uuid LIKE :store", { store: `${storeUuid}%` })
      .andWhere("j.createdAt BETWEEN :start AND :end", { start: startOfDay, end: endOfDay })
      .getRawMany();

    let todayItemsSold = 0;
    soldItems.forEach(i => {
        todayItemsSold += Number(i.jd_value || 0);
    });

    // 3. Aktivitas Terakhir (5 Transaksi Terakhir)
    const recentJournals = await this.dataSource.getRepository(JournalEntity)
      .createQueryBuilder('j')
      .leftJoinAndSelect(JournalDetailEntity, 'jd', "jd.journalCode = j.code AND jd.key = 'grand_total'")
      .where("j.uuid LIKE :store", { store: `${storeUuid}%` })
      .orderBy('j.createdAt', 'DESC')
      .limit(5)
      .getRawMany();

    const recentActivities = recentJournals.map(j => {
        let type = 'neutral';
        let amountPrefix = '';
        if (j.j_code.startsWith('SALE')) { type = 'in'; amountPrefix = '+'; }
        else if (j.j_code.startsWith('BUY')) { type = 'out'; amountPrefix = '-'; }

        // Format waktu
        const dateObj = new Date(j.j_createdAt);
        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        return {
            title: `Transaksi ${j.j_code}`,
            time: `Hari ini, ${timeStr}`,
            amount: `${amountPrefix} Rp ${Number(j.jd_value || 0).toLocaleString('id-ID')}`,
            type: type
        };
    });

    // 4. Data Dummy Piutang & Stok (Bisa dikembangkan nanti dengan logika khusus)
    const dueReceivables = 0; 
    const lowStockItems = 0;

    return {
      todayRevenue,
      todayTransactions,
      todayItemsSold,
      dueReceivables,
      lowStockItems,
      recentActivities
    };
  }
}