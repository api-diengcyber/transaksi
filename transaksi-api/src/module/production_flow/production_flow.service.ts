import {
    Injectable,
    Inject,
    NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductionFlowEntity } from 'src/common/entities/production_flow/production_flow.entity'; //
import { ProductionFlowUserEntity } from 'src/common/entities/production_flow_user/production_flow_user.entity'; //
import { CreateProductionFlowDto } from './dto/create-production-flow.dto';
import { UpdateProductionFlowDto } from './dto/update-production-flow.dto';
import { generateLocalUuid } from 'src/common/utils/generate_uuid_util';

@Injectable()
export class ProductionFlowService {
    constructor(
        @Inject('PRODUCTION_FLOW_REPOSITORY')
        private flowRepository: Repository<ProductionFlowEntity>,

        @Inject('PRODUCTION_FLOW_USER_REPOSITORY')
        private flowUserRepository: Repository<ProductionFlowUserEntity>,
    ) { }

    async create(createDto: CreateProductionFlowDto, userId: string, storeUuid: string): Promise<ProductionFlowEntity> {
        // productUuid akan otomatis masuk ke flowData karena ada di DTO
        const { workerUserUuids, ...flowData } = createDto;

        // 1. Simpan Flow
        const flowUuid = `${storeUuid}-FLOW-${generateLocalUuid()}`;
        const newFlow = this.flowRepository.create({
            ...flowData,
            uuid: flowUuid,
            createdBy: userId,
        });

        const savedFlow = await this.flowRepository.save(newFlow);

        // 2. Simpan Workers (Pivot) jika ada
        if (workerUserUuids && workerUserUuids.length > 0) {
            const pivotEntities = workerUserUuids.map(userUuid => {
                return this.flowUserRepository.create({
                    uuid: `${storeUuid}-WKR-${generateLocalUuid()}-${Math.random().toString(36).substring(7)}`,
                    productionFlowUuid: savedFlow.uuid,
                    userUuid: userUuid,
                    assignedBy: userId
                });
            });
            await this.flowUserRepository.save(pivotEntities);
        }

        return this.findOne(savedFlow.uuid);
    }

    async findAllByProduction(productionUuid: string): Promise<ProductionFlowEntity[]> {
        return this.flowRepository.find({
            where: { productionUuid },
            // Tambahkan 'product' ke relations agar detail produk muncul
            relations: ['workers', 'workers.user', 'product'],
            order: { stepOrder: 'ASC' },
        });
    }

    async findOne(uuid: string): Promise<ProductionFlowEntity> {
        const flow = await this.flowRepository.findOne({
            where: { uuid },
            // Tambahkan 'product' ke relations
            relations: ['workers', 'workers.user', 'product'],
        });
        if (!flow) throw new NotFoundException('Flow tidak ditemukan');
        return flow;
    }

    async update(uuid: string, updateDto: UpdateProductionFlowDto, userId: string, storeUuid: string): Promise<ProductionFlowEntity> {
        const flow = await this.findOne(uuid);
        const { workerUserUuids, ...updateData } = updateDto;

        // Update data dasar flow (termasuk productUuid jika ada di updateData)
        await this.flowRepository.update(uuid, {
            ...updateData,
            updatedBy: userId,
            completedAt: updateData.isCompleted ? new Date() : (updateData.isCompleted === false ? "" : flow.completedAt),
        });

        // Update Workers (Full Replace Strategy)
        if (workerUserUuids) {
            // Hapus yang lama
            await this.flowUserRepository.delete({ productionFlowUuid: uuid });

            // Insert yang baru
            if (workerUserUuids.length > 0) {
                const pivotEntities = workerUserUuids.map(userUuid => {
                    return this.flowUserRepository.create({
                        uuid: `${storeUuid}-WKR-${generateLocalUuid()}-${Math.random().toString(36).substring(7)}`,
                        productionFlowUuid: uuid,
                        userUuid: userUuid,
                        assignedBy: userId
                    });
                });
                await this.flowUserRepository.save(pivotEntities);
            }
        }

        return this.findOne(uuid);
    }

    async remove(uuid: string) {
        return this.flowRepository.delete(uuid);
    }
}