// src/module/ie/ie-product.service.ts
import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as stream from 'stream';
import * as crypto from 'crypto';

import { ProductEntity } from 'src/common/entities/product/product.entity';
import { CategoryEntity } from 'src/common/entities/category/category.entity';
import { BrandEntity } from 'src/common/entities/brand/brand.entity';
import { UnitEntity } from 'src/common/entities/unit/unit.entity';
import { ShelveEntity } from 'src/common/entities/shelve/shelve.entity';
import { PriceGroupEntity } from 'src/common/entities/price_group/price_group.entity';
import { generateCategoryUuid, generateBrandUuid, generateUnitUuid, generateShelveUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class IeProductService {
  constructor(
    private readonly productService: ProductService,
    @Inject('PRODUCT_REPOSITORY') private readonly productRepo: Repository<ProductEntity>,
    @Inject('CATEGORY_REPOSITORY') private readonly categoryRepo: Repository<CategoryEntity>,
    @Inject('BRAND_REPOSITORY') private readonly brandRepo: Repository<BrandEntity>,
    @Inject('UNIT_REPOSITORY') private readonly unitRepo: Repository<UnitEntity>,
    @Inject('SHELVE_REPOSITORY') private readonly shelveRepo: Repository<ShelveEntity>,
    @Inject('PRICE_GROUP_REPOSITORY') private readonly priceGroupRepo: Repository<PriceGroupEntity>,
  ) {}

  // Helper untuk Ekspor Harga
  private extractPrices(pricesArray: any[]) {
    let hn = 0, hm = 0, mgn = 0, hgn = 0, mgm = 0, hgm = 0;
    if (pricesArray && pricesArray.length > 0) {
      pricesArray.forEach(pr => {
        const gName = pr.priceGroup?.name?.toLowerCase() || '';
        if (gName.includes('normal') || gName === 'umum') {
          if (pr.minQty <= 1) hn = Number(pr.price);
          else { mgn = pr.minQty; hgn = Number(pr.price); }
        } else if (gName.includes('member')) {
          if (pr.minQty <= 1) hm = Number(pr.price);
          else { mgm = pr.minQty; hgm = Number(pr.price); }
        }
      });
    }
    return { hn, hm, mgn, hgn, mgm, hgm };
  }

  // --- FUNGSI EXPORT PRODUK ---
  async exportProductData(storeUuid: string, format: 'xlsx' | 'xls' | 'csv'): Promise<Buffer> {
    try {
      const [products, categories, brands, units, shelves] = await Promise.all([
        this.productRepo.find({ relations: ['brand', 'unit', 'variants', 'variants.prices', 'variants.prices.priceGroup', 'shelves', 'prices', 'prices.priceGroup'] }), 
        this.categoryRepo.find(),
        this.brandRepo.find(),
        this.unitRepo.find(),
        this.shelveRepo.find(),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'RetailApp Pro';
      
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

      // --- STRUKTUR KOLOM BARU (Mendukung Varian Sub-Baris & Stok) ---
      wsProducts.columns = [
        { header: 'Tipe', key: 'tipe', width: 15 },                     // A: Produk / Varian
        { header: 'Nama Produk/Varian', key: 'name', width: 35 },       // B
        { header: 'Barcode', key: 'barcode', width: 20 },               // C
        { header: 'Kategori', key: 'category', width: 25 },             // D
        { header: 'Merek', key: 'brand', width: 25 },                   // E
        { header: 'Satuan', key: 'unit', width: 20 },                   // F
        { header: 'Lokasi Rak', key: 'shelve', width: 25 },             // G
        { header: 'Kelola Stok', key: 'manageStock', width: 15 },       // H
        { header: 'Sistem HPP', key: 'hppMethod', width: 15 },          // I
        { header: 'PPN Jual (%)', key: 'saleTax', width: 15 },          // J
        { header: 'Stok', key: 'stock', width: 15 },                    // K
        { header: 'Harga Normal', key: 'hargaNormal', width: 20 },      // L
        { header: 'Harga Member', key: 'hargaMember', width: 20 },      // M
        { header: 'Min Grosir Normal', key: 'minGrosirNormal', width: 20 }, // N
        { header: 'Harga Grosir Normal', key: 'hargaGrosirNormal', width: 20 }, // O
        { header: 'Min Grosir Member', key: 'minGrosirMember', width: 20 }, // P
        { header: 'Harga Grosir Member', key: 'hargaGrosirMember', width: 20 }, // Q
      ];

      wsProducts.getRow(1).font = { bold: true };
      wsProducts.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      // 4. MASUKKAN DATA (PRODUK & VARIAN)
      products.forEach(p => {
        const productCategory = categories.find(c => c.uuid === p.categoryUuid);
        const pPrices = this.extractPrices(p.prices);

        // Baris Induk (Produk)
        const rowProduk = wsProducts.addRow({
          tipe: 'Produk',
          name: p.name,
          barcode: p.barcode || '-',
          category: productCategory ? productCategory.name : '', 
          brand: p.brand?.name || '',
          unit: p.unit?.name || '',
          shelve: p.shelves && p.shelves.length > 0 ? p.shelves.map(s => s.name).join(', ') : '',
          manageStock: p.isManageStock ? 'Ya' : 'Tidak',
          hppMethod: p.hppMethod || 'FIFO',
          saleTax: p.saleTaxPercentage ? Number(p.saleTaxPercentage) : 0,
          stock: (p as any).stock || 0, // Asumsi properti stok ada
          hargaNormal: pPrices.hn,
          hargaMember: pPrices.hm,
          minGrosirNormal: pPrices.mgn,
          hargaGrosirNormal: pPrices.hgn,
          minGrosirMember: pPrices.mgm,
          hargaGrosirMember: pPrices.hgm,
        });
        rowProduk.font = { bold: true }; // Produk ditebalkan agar jelas pemisahnya

        // Baris Anak (Varian) di bawah Produk
        if (p.variants && p.variants.length > 0) {
          p.variants.forEach(v => {
            const vPrices = this.extractPrices(v.prices);
            const rowVarian = wsProducts.addRow({
              tipe: 'Varian',
              name: `  ↳ ${v.name}`, // Indentasi visual
              barcode: (v as any).barcode || '-',
              category: '', brand: '', unit: '', shelve: '', manageStock: '', hppMethod: '', saleTax: '', // Dikosongkan karena ikut induk
              stock: (v as any).stock || 0,
              hargaNormal: vPrices.hn,
              hargaMember: vPrices.hm,
              minGrosirNormal: vPrices.mgn,
              hargaGrosirNormal: vPrices.hgn,
              minGrosirMember: vPrices.mgm,
              hargaGrosirMember: vPrices.hgm,
            });
            rowVarian.font = { color: { argb: 'FF4F4F4F' } }; // Varian sedikit abu-abu
          });
        }
      });

      // 5. VALIDASI DROPDOWN EXCEL (Pergeseran kolom D ke H)
      if (format !== 'csv') {
        for (let i = 2; i <= 1000; i++) {
          wsProducts.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Produk,Varian"'] };
          if (categories.length > 0) wsProducts.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Kategori!$B$2:$B$${categories.length + 1}`] };
          if (brands.length > 0) wsProducts.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Merek!$B$2:$B$${brands.length + 1}`] };
          if (units.length > 0) wsProducts.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Satuan!$B$2:$B$${units.length + 1}`] };
          if (shelves.length > 0) wsProducts.getCell(`G${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Rak!$B$2:$B$${shelves.length + 1}`] };
          wsProducts.getCell(`H${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ya,Tidak"'] };
          wsProducts.getCell(`I${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"FIFO,LIFO,AVERAGE"'] };
        }
      }

      let buffer;
      if (format === 'csv') buffer = await workbook.csv.writeBuffer();
      else buffer = await workbook.xlsx.writeBuffer();

      return buffer as Buffer;
      
    } catch (error) {
      throw new InternalServerErrorException('Gagal menyiapkan file ekspor.');
    }
  }

  // --- FUNGSI IMPORT PRODUK (Dengan Grouping Varian) ---
  async importProductData(fileBuffer: Buffer, storeUuid: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    
    try {
      await workbook.xlsx.load(fileBuffer as any);
    } catch (error) {
      try {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer as any); 
        await workbook.csv.read(bufferStream);
      } catch (csvError) {
        throw new InternalServerErrorException('Format file tidak didukung. Harap gunakan format XLSX atau CSV.');
      }
    }

    const parseWorksheet = (worksheet: ExcelJS.Worksheet) => {
      if (!worksheet) return [];
      const rows: Record<string, any>[] = []; 
      const headers: Record<number, string> = {};
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => { headers[colNumber] = cell.value?.toString().trim() || ''; });
        } else {
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

    // [Bagian Import Kategori, Merek, Satuan, Rak Disingkat namun tetap berjalan]
    const ensureRef = async (sheetName: string, repo: any, generateUuid: any) => {
      const ws = workbook.getWorksheet(sheetName);
      if (ws) {
        for (const row of parseWorksheet(ws)) {
          const name = row[`Nama ${sheetName}`];
          if (name && !(await repo.findOne({ where: { name } }))) {
            await repo.save(repo.create({ uuid: generateUuid(storeUuid), name }));
          }
        }
      }
    };

    await ensureRef('Kategori', this.categoryRepo, generateCategoryUuid);
    await ensureRef('Merek', this.brandRepo, generateBrandUuid);
    await ensureRef('Satuan', this.unitRepo, generateUnitUuid);
    await ensureRef('Rak', this.shelveRepo, generateShelveUuid);

    // Ambil Referensi Price Group
    let allPriceGroups = await this.priceGroupRepo.find();
    let normalGroup = allPriceGroups.find(g => g.name.toLowerCase() === 'normal' || g.name.toLowerCase() === 'umum');
    if (!normalGroup) {
      normalGroup = this.priceGroupRepo.create({ uuid: crypto.randomUUID(), name: 'Normal' });
      await this.priceGroupRepo.save(normalGroup);
    }
    let memberGroup = allPriceGroups.find(g => g.name.toLowerCase() === 'member');
    if (!memberGroup) {
      memberGroup = this.priceGroupRepo.create({ uuid: crypto.randomUUID(), name: 'Member' });
      await this.priceGroupRepo.save(memberGroup);
    }

    const [allCategories, allBrands, allUnits, allShelves] = await Promise.all([
      this.categoryRepo.find(), this.brandRepo.find(), this.unitRepo.find(), this.shelveRepo.find(),
    ]);

    const wsProducts = workbook.getWorksheet('Produk') || workbook.worksheets[0];
    if (!wsProducts) return { message: 'Gagal', success: 0, failed: 0, errors: ['Sheet "Produk" tidak ditemukan.'] };

    const productsData = parseWorksheet(wsProducts);

    // --- STEP 1: GROUPING BARIS (Kumpulkan Varian ke Induknya) ---
    const groupedProducts: any[] = [];
    let currentProd: any = null;

    for (const [index, row] of productsData.entries()) {
      const tipe = row['Tipe']?.toString().toUpperCase();
      let name = row['Nama Produk/Varian'];
      if (!name) continue;

      // Bersihkan simbol indentasi "↳" jika ada
      name = name.replace('↳', '').trim();

      if (tipe === 'PRODUK' || (!tipe && row['Kategori'])) {
        if (currentProd) groupedProducts.push(currentProd);
        currentProd = { rowNumber: index + 2, row, variants: [] };
      } else if (tipe === 'VARIAN' || (!tipe && !row['Kategori'])) {
        if (currentProd) {
          currentProd.variants.push({ row, nameCleaned: name });
        }
      }
    }
    if (currentProd) groupedProducts.push(currentProd);

    // --- STEP 2: PROSES DATA GROUPED KE DALAM DATABASE ---
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = []; 

    const parsePricesDto = (row: any) => {
      const prices: any[] = [];
      if (row['Harga Normal']) prices.push({ priceGroupUuid: normalGroup.uuid, name: 'Normal', price: Number(row['Harga Normal']), minQty: 1 });
      if (row['Harga Grosir Normal'] && row['Min Grosir Normal']) prices.push({ priceGroupUuid: normalGroup.uuid, name: 'Grosir Normal', price: Number(row['Harga Grosir Normal']), minQty: Number(row['Min Grosir Normal']) });
      if (row['Harga Member']) prices.push({ priceGroupUuid: memberGroup.uuid, name: 'Member', price: Number(row['Harga Member']), minQty: 1 });
      if (row['Harga Grosir Member'] && row['Min Grosir Member']) prices.push({ priceGroupUuid: memberGroup.uuid, name: 'Grosir Member', price: Number(row['Harga Grosir Member']), minQty: Number(row['Min Grosir Member']) });
      return prices;
    };

    for (const item of groupedProducts) {
      const row = item.row;
      let name = row['Nama Produk/Varian'].replace('↳', '').trim();
      const barcode = row['Barcode'] && row['Barcode'] !== '-' ? row['Barcode'] : undefined;

      try {
        const whereCondition = barcode ? [{ name }, { barcode }] : [{ name }];
        const existingProduct = await this.productRepo.findOne({ where: whereCondition });

        if (existingProduct) {
          failedCount++;
          errors.push(`Baris ${item.rowNumber}: Produk "${name}" sudah ada di sistem.`);
          continue; 
        }

        const brand = allBrands.find(b => b.name === row['Merek']);
        const unit = allUnits.find(u => u.name === row['Satuan']);
        
        let categoryUuid: any = null; 
        if (row['Kategori']) {
          const cat = allCategories.find(c => c.name === String(row['Kategori']).split(',')[0].trim());
          if (cat) categoryUuid = cat.uuid;
        }

        let shelveUuids: any[] = []; 
        if (row['Lokasi Rak']) {
          const shelveNames = String(row['Lokasi Rak']).split(',').map(s => s.trim());
          shelveUuids = allShelves.filter(s => shelveNames.includes(s.name)).map(s => s.uuid);
        }

        let saleTaxPercentage = 0;
        if (row['PPN Jual (%)']) {
            const parsedTax = parseFloat(String(row['PPN Jual (%)']).replace('%', '').trim());
            if (!isNaN(parsedTax)) saleTaxPercentage = parsedTax;
        }

        // Susun DTO Varian
        const variantsDto = item.variants.map(v => {
           return {
             name: v.nameCleaned,
             barcode: v.row['Barcode'] && v.row['Barcode'] !== '-' ? v.row['Barcode'] : undefined,
             stock: Number(v.row['Stok'] || 0),
             prices: parsePricesDto(v.row)
           };
        });

        // DTO Utama Produk
        const dto: any = {
          name: name,
          barcode: barcode,
          unitUuid: unit?.uuid,
          categoryUuid: categoryUuid,
          brandUuid: brand?.uuid,
          isManageStock: row['Kelola Stok'] === 'Ya' || row['Kelola Stok'] === 'TRUE',
          hppMethod: ['FIFO', 'LIFO', 'AVERAGE'].includes(row['Sistem HPP']?.toString().toUpperCase()) ? row['Sistem HPP'].toUpperCase() : 'FIFO',
          saleTaxPercentage: saleTaxPercentage, 
          conversionQty: 1,
          stock: Number(row['Stok'] || 0), // Memasukkan nilai stok ke DTO Produk
          prices: parsePricesDto(row),
          variants: variantsDto, // <--- VARIAN DISISIPKAN DI SINI
          shelveUuids: shelveUuids,
        };

        await this.productService.create(dto, storeUuid, userId);
        successCount++;
        
      } catch (error) {
        failedCount++;
        errors.push(`Baris ${item.rowNumber} (${name}): ${error}`);
      }
    }

    return {
      message: 'Proses import selesai',
      totalData: groupedProducts.length,
      success: successCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}