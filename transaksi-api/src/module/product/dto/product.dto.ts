import { ProductUnitEnum } from "src/common/entities/product_unit/product_unit.entity";

export interface CreateUnitDto {
  unitName: ProductUnitEnum;
  unitMultiplier: number;
  price: number;
  stock: number;
  barcode: string;
  isDefault: boolean;
}

export interface CreateProductDto {
  name: string;
  userId?: string;
  units: {
    tempId: number; // ID Sementara dari Frontend
    name: ProductUnitEnum;
    multiplier: number;
    barcode: string;
    isDefault: boolean;
  }[];
  prices: {
    unitTempId: number; // Link ke unit berdasarkan tempId
    name: string; // Nama Harga (Umum, Grosir, dll)
    price: number;
    isDefault: boolean;
  }[];
  stocks: {
    unitTempId: number;
    qty: number;
  }[];
}