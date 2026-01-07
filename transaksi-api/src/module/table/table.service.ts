import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { TableEntity, TableStatus } from "src/common/entities/tables/table.entity";
import { Repository, DataSource, Like } from "typeorm";
import { CreateTableDto, UpdateTableDto } from "./dto/create-table.dto";
import { BookTableDto } from "./dto/update-status.dto";
import { JournalService } from "../journal/journal.service";
import { generateTableUuid } from "src/common/utils/generate_uuid_util";

@Injectable()
export class TableService {
  private readonly logger = new Logger(TableService.name);

  constructor(
    @Inject('TABLE_REPOSITORY')
    private readonly tableRepo: Repository<TableEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
    private readonly journalService: JournalService,
  ) { }

  // ============================
  // CREATE TABLE
  // ============================
  async create(payload: CreateTableDto, userId: string, storeUuid: string) {
    if (!storeUuid) {
      throw new BadRequestException('Store ID is required for table creation.');
    }
    const customTableUuid = generateTableUuid(storeUuid);

    const newTable = this.tableRepo.create({
      uuid: customTableUuid,
      ...payload,
      createdBy: userId,
    });
    return await this.tableRepo.save(newTable);
  }

  // ============================
  // FIND ALL
  // ============================
  async findAll(storeUuid: string) {
    const whereCondition: { uuid?: any } = {};
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-TBL-%`);
    }
    const tables = await this.tableRepo.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
    return tables;
  }

  // ============================
  // FIND ONE
  // ============================
  async findOne(uuid: string, storeUuid?: string) {
    const whereCondition: { uuid: any } = { uuid };
    
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-TBL-%`);
    }
    
    const table = await this.tableRepo.findOne({
      where: whereCondition,
    });

    if (!table || (storeUuid && !table.uuid.startsWith(`${storeUuid}-TBL-`))) { 
      return null;
    }

    return table;
  }

  // ============================
  // UPDATE TABLE
  // ============================
  async update(uuid: string, payload: UpdateTableDto, userId: string, storeUuid: string) {
    const table = await this.findOne(uuid, storeUuid);

    if (!table) {
      throw new NotFoundException(`Table with UUID ${uuid} not found in this store`);
    }
    
    if (payload.name) table.name = payload.name;
    if (payload.capacity) table.capacity = payload.capacity;
    
    table.updatedBy = userId;

    return await this.tableRepo.save(table);
  }

  // ============================
  // DELETE (Soft Delete)
  // ============================
  async remove(uuid: string, userId: string, storeUuid: string) {
    const table = await this.findOne(uuid, storeUuid);

    if (!table) {
      throw new NotFoundException(`Table with UUID ${uuid} not found in this store`);
    }

    table.deletedBy = userId;
    await this.tableRepo.save(table);

    return await this.tableRepo.softDelete(uuid);
  }

  // ============================
  // RESTORE
  // ============================
  async restore(uuid: string, storeUuid: string) {
     const table = await this.findOne(uuid, storeUuid);

    if (!table) {
      throw new NotFoundException(`Table with UUID ${uuid} not found in this store`);
    }
    
    return await this.tableRepo.restore(uuid);
  }
  
  // ============================
  // BOOK TABLE -> LOG TO JOURNAL
  // ============================
  async bookTable(uuid: string, payload: BookTableDto, storeUuid: string, userId: string) {
    const table = await this.findOne(uuid, storeUuid);
    if (!table) throw new NotFoundException('Table not found');

    if (table.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException('Table is not available for booking');
    }

    // 1. Update Status Meja di Realtime (Database)
    table.status = TableStatus.BOOKED;
    table.updatedBy = userId;
    await this.tableRepo.save(table);

    // 2. Siapkan Data Logging Jurnal
    const timestamp = Date.now();
    const cleanTableName = table.name.replace(/\s+/g, '').toUpperCase();
    const specialCode = `BOOK-${cleanTableName}-${timestamp}`;
    
    // Format Notes untuk Journal
    const journalNotes = `[BOOKING] Table: ${table.name}. By: ${payload.bookingName}. Notes: ${payload.notes || '-'}`;

    // 3. Eksekusi Journal Service
    try {
        await this.journalService.createSale({
            amount: 0, // Nominal 0 karena hanya booking (kecuali ada DP, logic bisa disesuaikan)
            grand_total: 0,
            payment_method: 'BOOKING_SYSTEM',
            customer_name: payload.bookingName,
            // Simpan kode unik & detail di notes
            notes: `CODE: ${specialCode}. ${journalNotes}`, 
            due_date: new Date(payload.bookingTime).toISOString(),
            is_credit: true, // Status 'Piutang/Pending' menandakan Booking aktif
            
            // Opsional: Jika Journal mensupport field custom lain, masukkan di sini
            target_store_uuid: storeUuid
        }, userId, storeUuid);
    } catch (error) {
        this.logger.error(`Failed to log booking for table ${uuid}`, error);
        // Kita tidak throw error agar status meja tetap 'BOOKED' meski log jurnal gagal
    }

    return table;
  }

  // ============================
  // OCCUPY TABLE (CHECK-IN)
  // ============================
  async occupyTable(uuid: string, storeUuid: string, userId: string) {
    const table = await this.findOne(uuid, storeUuid);
    if (!table) throw new NotFoundException('Table not found');

    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Table is already occupied');
    }

    // 1. Update Status Meja
    table.status = TableStatus.OCCUPIED;
    table.updatedBy = userId;
    await this.tableRepo.save(table);

    // 2. Logging Journal Check-In
    const cleanTableName = table.name.replace(/\s+/g, '').toUpperCase();
    const specialCode = `IN-${cleanTableName}-${Date.now()}`;

    try {
        await this.journalService.createSale({
            amount: 0,
            grand_total: 0,
            payment_method: 'CHECKIN_SYSTEM',
            customer_name: 'Walk-In / Guest', // Default karena data nama ada di jurnal booking sebelumnya
            notes: `CODE: ${specialCode}. [CHECK-IN] Table ${table.name} is now OCCUPIED.`,
            is_credit: true, // Masih proses berjalan (belum bayar/selesai)
            target_store_uuid: storeUuid
        }, userId, storeUuid);
    } catch (error) {
        this.logger.error(`Failed to log check-in for table ${uuid}`, error);
    }

    return table;
  }

  // ============================
  // CLEAR TABLE (SELESAI)
  // ============================
  async clearTable(uuid: string, storeUuid: string, userId: string) {
    const table = await this.findOne(uuid, storeUuid);
    if (!table) throw new NotFoundException('Table not found');

    // 1. Update Status Meja menjadi AVAILABLE
    table.status = TableStatus.AVAILABLE;
    table.updatedBy = userId;
    await this.tableRepo.save(table);

    // 2. Logging Journal Selesai
    const cleanTableName = table.name.replace(/\s+/g, '').toUpperCase();
    const specialCode = `OUT-${cleanTableName}-${Date.now()}`;

    try {
        await this.journalService.createSale({
            amount: 0,
            grand_total: 0,
            payment_method: 'CLEAR_SYSTEM',
            customer_name: '-',
            notes: `CODE: ${specialCode}. [CLEARED] Table ${table.name} is now CLEAN & AVAILABLE.`,
            is_credit: false, // false menandakan transaksi/cycle ini selesai
            target_store_uuid: storeUuid
        }, userId, storeUuid);
    } catch (error) {
        this.logger.error(`Failed to log clear table for ${uuid}`, error);
    }

    return table;
  }
}