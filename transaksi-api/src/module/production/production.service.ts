import {
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    Inject,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductionEntity } from 'src/common/entities/production/production.entity'; // Asumsi path entity
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';
import { generateProductionDetailUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class ProductionService {
    constructor(
        @Inject('PRODUCTION_REPOSITORY')
        private productionRepository: Repository<ProductionEntity>,
    ) { }

    /**
     * Membuat data produksi baru
     */
    async create(
        createProductionDto: CreateProductionDto,
        userId: string,
        storeUuid: string,
    ): Promise<ProductionEntity> {
        try {
            const customUuid = generateProductionDetailUuid(storeUuid);
            const newProduction = this.productionRepository.create({
                ...createProductionDto,
                uuid: customUuid,
                createdBy: userId,
            });

            return await this.productionRepository.save(newProduction);
        } catch (error) {
            throw new InternalServerErrorException('Gagal membuat data produksi.');
        }
    }

    /**
     * Mendapatkan semua data produksi yang aktif (tidak terhapus)
     */
    async findAll(): Promise<ProductionEntity[]> {
        return this.productionRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Mendapatkan satu data produksi berdasarkan UUID
     */
    async findOne(uuid: string): Promise<ProductionEntity> {
        const production = await this.productionRepository.findOne({
            where: {
                uuid,
            },
        });
        if (!production) {
            throw new NotFoundException(`Produksi dengan UUID ${uuid} tidak ditemukan.`);
        }
        return production;
    }

    /**
     * Memperbarui data produksi
     */
    async update(
        uuid: string,
        updateProductionDto: UpdateProductionDto,
        userId: string,
    ): Promise<ProductionEntity> {
        const production = await this.findOne(uuid); // Memastikan data ada

        // Merge data baru dengan data lama
        const updatedProduction = this.productionRepository.merge(production, {
            ...updateProductionDto,
            updatedBy: userId,
        });

        try {
            return await this.productionRepository.save(updatedProduction);
        } catch (error) {
            throw new InternalServerErrorException('Gagal memperbarui data produksi.');
        }
    }

    /**
     * Menghapus data produksi (Soft Delete)
     */
    async remove(uuid: string, userId: string): Promise<void> {
        const production = await this.findOne(uuid); // Memastikan data ada

        // Melakukan soft delete dengan mengisi deletedAt dan deletedBy
        await this.productionRepository.update(production.uuid, {
            deletedAt: new Date(),
            deletedBy: userId,
        });
    }
}