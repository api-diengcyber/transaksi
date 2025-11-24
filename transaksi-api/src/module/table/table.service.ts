import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { TableEntity } from "src/common/entities/tables/table.entity";
import { Repository, DataSource, Like } from "typeorm";
import { CreateTableDto, UpdateTableDto } from "./dto/create-table.dto";

// [BARU] Helper untuk menghasilkan pengenal lokal
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
// [BARU] Helper untuk menghasilkan UUID Meja dengan prefix Store (Format: [storeUuid]-TBL-[local_identifier])
const generateTableUuid = (storeUuid: string) => `${storeUuid}-TBL-${generateLocalUuid()}`;

@Injectable()
export class TableService {
  constructor(
    @Inject('TABLE_REPOSITORY') // Asumsi provider TypeORM sudah dibuat dengan nama ini
    private readonly tableRepo: Repository<TableEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
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
  // FIND ONE (with Store Ownership Check)
  // ============================
  async findOne(uuid: string, storeUuid?: string) {
    const whereCondition: { uuid: any } = { uuid };
    
    if (storeUuid) {
      whereCondition.uuid = Like(`${storeUuid}-TBL-%`);
    }
    
    const table = await this.tableRepo.findOne({
      where: whereCondition,
    });

    // Validasi tambahan untuk memastikan ownership jika storeUuid ada
    if (!table || (storeUuid && !table.uuid.startsWith(`${storeUuid}-TBL-`))) { 
      return null;
    }

    return table;
  }

  // ============================
  // UPDATE TABLE
  // ============================
  async update(uuid: string, payload: UpdateTableDto, userId: string, storeUuid: string) {
    const table = await this.findOne(uuid, storeUuid); // Validasi kepemilikan

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
    const table = await this.findOne(uuid, storeUuid); // Validasi kepemilikan

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
     const table = await this.findOne(uuid, storeUuid); // Validasi kepemilikan

    if (!table) {
      throw new NotFoundException(`Table with UUID ${uuid} not found in this store`);
    }
    
    return await this.tableRepo.restore(uuid);
  }
}