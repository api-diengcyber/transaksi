
import { PartialType } from '@nestjs/swagger';
import { CreateProductionDto } from './create-production.dto';

// Memungkinkan semua field di CreateProductionDto bersifat opsional untuk update
export class UpdateProductionDto extends PartialType(CreateProductionDto) { }