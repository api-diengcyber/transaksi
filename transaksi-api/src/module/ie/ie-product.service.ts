// src/module/ie/ie.service.ts
import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as stream from 'stream';

import { ProductEntity } from 'src/common/entities/product/product.entity';
import { CategoryEntity } from 'src/common/entities/category/category.entity';
import { BrandEntity } from 'src/common/entities/brand/brand.entity';
import { UnitEntity } from 'src/common/entities/unit/unit.entity';
import { ShelveEntity } from 'src/common/entities/shelve/shelve.entity';

@Injectable()
export class IeProductService {
  constructor(
    private readonly productService: ProductService,
    @Inject('PRODUCT_REPOSITORY') private readonly productRepo: Repository<ProductEntity>,
    @Inject('CATEGORY_REPOSITORY') private readonly categoryRepo: Repository<CategoryEntity>,
    @Inject('BRAND_REPOSITORY') private readonly brandRepo: Repository<BrandEntity>,
    @Inject('UNIT_REPOSITORY') private readonly unitRepo: Repository<UnitEntity>,
    @Inject('SHELVE_REPOSITORY') private readonly shelveRepo: Repository<ShelveEntity>,
  ) {}

  // --- FUNGSI EXPORT PRODUK (DENGAN DROPDOWN EXCELJS) ---
  async exportProductData(storeUuid: string, format: 'xlsx' | 'xls' | 'csv'): Promise<Buffer> {
    try {
      console.log(`[IE Service] Memulai ekspor data menggunakan ExcelJS... Format: ${format}`);

      // 1. AMBIL DATA
      // Hapus 'categories' dari relations karena kita akan menggunakan categoryUuid
      const [products, categories, brands, units, shelves] = await Promise.all([
        this.productRepo.find({ relations: ['brand', 'unit', 'variants', 'shelves'] }), 
        this.categoryRepo.find(),
        this.brandRepo.find(),
        this.unitRepo.find(),
        this.shelveRepo.find(),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Dieng Cyber';
      workbook.created = new Date();

      // ... (Bagian 1 sampai 3 tetap sama seperti sebelumnya) ...
      const wsProducts = workbook.addWorksheet('Produk');
      const wsCategories = workbook.addWorksheet('Kategori');
      const wsBrands = workbook.addWorksheet('Merek');
      const wsUnits = workbook.addWorksheet('Satuan');
      const wsShelves = workbook.addWorksheet('Rak');

      wsCategories.columns = [{ header: 'UUID', key: 'uuid', width: 40 }, { header: 'Nama Kategori', key: 'name', width: 30 }];
      categories.forEach(c => wsCategories.addRow({ uuid: c.uuid, name: c.name }));

      wsBrands.columns = [{ header: 'UUID', key: 'uuid', width: 40 }, { header: 'Nama Merek', key: 'name', width: 30 }];
      brands.forEach(b => wsBrands.addRow({ uuid: b.uuid, name: b.name }));

      wsUnits.columns = [{ header: 'UUID', key: 'uuid', width: 40 }, { header: 'Nama Satuan', key: 'name', width: 30 }];
      units.forEach(u => wsUnits.addRow({ uuid: u.uuid, name: u.name }));

      wsShelves.columns = [{ header: 'UUID', key: 'uuid', width: 40 }, { header: 'Nama Rak', key: 'name', width: 30 }];
      shelves.forEach(s => wsShelves.addRow({ uuid: s.uuid, name: s.name }));

      wsProducts.columns = [
        { header: 'Nama Produk', key: 'name', width: 35 },     
        { header: 'Barcode', key: 'barcode', width: 20 },      
        { header: 'Kategori', key: 'category', width: 25 },    
        { header: 'Merek', key: 'brand', width: 25 },          
        { header: 'Satuan', key: 'unit', width: 20 },          
        { header: 'Lokasi Rak', key: 'shelve', width: 25 },    
        { header: 'Kelola Stok', key: 'manageStock', width: 15 }, 
        { header: 'Total Varian', key: 'variants', width: 15 },   
      ];

      wsProducts.getRow(1).font = { bold: true };
      wsProducts.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      // 4. MASUKKAN DATA PRODUK [DIREVISI]
      products.forEach(p => {
        // Cari nama kategori secara manual berdasarkan categoryUuid
        const productCategory = categories.find(c => c.uuid === p.categoryUuid);

        wsProducts.addRow({
          name: p.name,
          barcode: p.barcode || '-',
          // Masukkan nama kategori jika ditemukan, jika tidak kosongkan
          category: productCategory ? productCategory.name : '', 
          brand: p.brand?.name || '',
          unit: p.unit?.name || '',
          shelve: p.shelves && p.shelves.length > 0 ? p.shelves.map(s => s.name).join(', ') : '',
          manageStock: p.isManageStock ? 'Ya' : 'Tidak',
          variants: p.variants?.length || 0,
        });
      });

      // ... (Bagian 5 dan 6 Data Validation dan Buffer tetap sama seperti sebelumnya) ...
      if (format !== 'csv') {
        for (let i = 2; i <= 1000; i++) {
          if (categories.length > 0) {
            wsProducts.getCell(`C${i}`).dataValidation = {
              type: 'list', allowBlank: true, formulae: [`Kategori!$B$2:$B$${categories.length + 1}`],
            };
          }
          if (brands.length > 0) {
            wsProducts.getCell(`D${i}`).dataValidation = {
              type: 'list', allowBlank: true, formulae: [`Merek!$B$2:$B$${brands.length + 1}`],
            };
          }
          if (units.length > 0) {
            wsProducts.getCell(`E${i}`).dataValidation = {
              type: 'list', allowBlank: true, formulae: [`Satuan!$B$2:$B$${units.length + 1}`],
            };
          }
          if (shelves.length > 0) {
            wsProducts.getCell(`F${i}`).dataValidation = {
              type: 'list', allowBlank: true, formulae: [`Rak!$B$2:$B$${shelves.length + 1}`],
            };
          }
          wsProducts.getCell(`G${i}`).dataValidation = {
            type: 'list', allowBlank: true, formulae: ['"Ya,Tidak"'],
          };
        }
      }

      let buffer;
      if (format === 'csv') buffer = await workbook.csv.writeBuffer();
      else buffer = await workbook.xlsx.writeBuffer();

      return buffer as Buffer;
      
    } catch (error) {
      console.error('[IE Service Error]', error);
      throw new InternalServerErrorException('Gagal menyiapkan file ekspor.');
    }
  }

  // --- FUNGSI IMPORT PRODUK (SMART IMPORT / CEK DUPLIKAT) ---
  async importProductData(fileBuffer: Buffer, storeUuid: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    
    // 1. BACA FILE (Mendukung XLSX dan CSV)
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (error) {
      try {
        const bufferStream = new stream.PassThrough();
        // [FIXED] Bypass type checking pada Buffer agar cocok dengan stream
        bufferStream.end(fileBuffer as any); 
        await workbook.csv.read(bufferStream);
      } catch (csvError) {
        throw new InternalServerErrorException('Format file tidak didukung. Harap gunakan format XLSX atau CSV.');
      }
    }

    // Helper untuk mengubah Worksheet menjadi Array of Object (JSON)
    const parseWorksheet = (worksheet: ExcelJS.Worksheet) => {
      if (!worksheet) return [];
      
      // [FIXED] Deklarasikan tipe data array of objects
      const rows: Record<string, any>[] = []; 
      const headers: Record<number, string> = {};
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value?.toString().trim() || '';
          });
        } else {
          // [FIXED] Deklarasikan tipe data object
          const rowData: Record<string, any> = {}; 
          row.eachCell((cell, colNumber) => {
            if (headers[colNumber]) {
               let cellValue = cell.value;
               if (cellValue && typeof cellValue === 'object' && 'richText' in cellValue) {
                 cellValue = (cellValue as any).richText.map((rt: any) => rt.text).join('');
               } else if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
                 cellValue = (cellValue as any).result; 
               }
               rowData[headers[colNumber]] = cellValue?.toString().trim();
            }
          });
          if (Object.keys(rowData).length > 0) rows.push(rowData);
        }
      });
      return rows;
    };

    const wsCategories = workbook.getWorksheet('Kategori');
    if (wsCategories) {
      for (const row of parseWorksheet(wsCategories)) {
        const name = row['Nama Kategori'];
        if (name && !(await this.categoryRepo.findOne({ where: { name } }))) {
          await this.categoryRepo.save(this.categoryRepo.create({ name }));
        }
      }
    }

    const wsBrands = workbook.getWorksheet('Merek');
    if (wsBrands) {
      for (const row of parseWorksheet(wsBrands)) {
        const name = row['Nama Merek'];
        if (name && !(await this.brandRepo.findOne({ where: { name } }))) {
          await this.brandRepo.save(this.brandRepo.create({ name }));
        }
      }
    }

    const wsUnits = workbook.getWorksheet('Satuan');
    if (wsUnits) {
      for (const row of parseWorksheet(wsUnits)) {
        const name = row['Nama Satuan'];
        if (name && !(await this.unitRepo.findOne({ where: { name } }))) {
          await this.unitRepo.save(this.unitRepo.create({ name }));
        }
      }
    }

    const wsShelves = workbook.getWorksheet('Rak');
    if (wsShelves) {
      for (const row of parseWorksheet(wsShelves)) {
        const name = row['Nama Rak'];
        if (name && !(await this.shelveRepo.findOne({ where: { name } }))) {
          await this.shelveRepo.save(this.shelveRepo.create({ name }));
        }
      }
    }

    const [allCategories, allBrands, allUnits, allShelves] = await Promise.all([
      this.categoryRepo.find(),
      this.brandRepo.find(),
      this.unitRepo.find(),
      this.shelveRepo.find(),
    ]);

    let successCount = 0;
    let failedCount = 0;
    
    // [FIXED] Deklarasikan array khusus string
    const errors: string[] = []; 

    const wsProducts = workbook.getWorksheet('Produk') || workbook.worksheets[0];
    if (!wsProducts) {
      return { message: 'Gagal', success: 0, failed: 0, errors: ['Sheet "Produk" tidak ditemukan.'] };
    }

    const productsData = parseWorksheet(wsProducts);

    for (const [index, row] of productsData.entries()) {
      const name = row['Nama Produk'];
      const barcode = row['Barcode'] && row['Barcode'] !== '-' ? row['Barcode'] : undefined;

      if (!name) continue;

      try {
        const whereCondition = barcode ? [{ name }, { barcode }] : [{ name }];
        const existingProduct = await this.productRepo.findOne({ where: whereCondition });

        if (existingProduct) {
          failedCount++;
          errors.push(`Baris ${index + 2}: Produk "${name}" atau Barcode tersebut sudah ada di sistem.`);
          continue; 
        }

        const brand = allBrands.find(b => b.name === row['Merek']);
        const unit = allUnits.find(u => u.name === row['Satuan']);
        
        // [FIXED] Deklarasikan union type string | null agar TypeScript mengizinkan pengisian ulang
        let categoryUuid: string | null = null; 
        if (row['Kategori']) {
          // [FIXED] Konversi eksplisit ke String sebelum split
          const catName = String(row['Kategori']).split(',')[0].trim();
          const cat = allCategories.find(c => c.name === catName);
          if (cat) categoryUuid = cat.uuid;
        }

        // [FIXED] Deklarasikan array of string
        let shelveUuids: string[] = []; 
        if (row['Lokasi Rak']) {
          // [FIXED] Konversi eksplisit ke String sebelum split
          const shelveNames = String(row['Lokasi Rak']).split(',').map((s: string) => s.trim());
          shelveUuids = allShelves.filter(s => shelveNames.includes(s.name)).map(s => s.uuid);
        }

        const dto: any = {
          name: name,
          barcode: barcode,
          unitUuid: unit?.uuid,
          categoryUuid: categoryUuid,
          brandUuid: brand?.uuid,
          isManageStock: row['Kelola Stok'] === 'Ya' || row['Kelola Stok'] === 'TRUE',
          conversionQty: 1,
          variants: [],
          prices: [],
          shelveUuids: shelveUuids,
        };

        await this.productService.create(dto, storeUuid, userId);
        successCount++;
        
      } catch (error) {
        failedCount++;
        // errors.push(`Baris ${index + 2} (${name}): ${error.message}`);
      }
    }

    return {
      message: 'Proses import selesai',
      totalData: productsData.length,
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}