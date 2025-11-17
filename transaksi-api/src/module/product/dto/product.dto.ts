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
  units: CreateUnitDto[];
}