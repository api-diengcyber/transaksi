import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProductionFlowService } from './production_flow.service';
import { CreateProductionFlowDto } from './dto/create-production-flow.dto';
import { UpdateProductionFlowDto } from './dto/update-production-flow.dto';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@UseGuards(AtGuard)
@Controller('production-flow')
export class ProductionFlowController {
    constructor(private readonly productionFlowService: ProductionFlowService) { }

    @Post()
    create(
        @Body() createDto: CreateProductionFlowDto,
        @GetUser('sub') userId: string,
        @GetUser('storeUuid') storeUuid: string,
    ) {
        return this.productionFlowService.create(createDto, userId, storeUuid);
    }

    @Get('by-production/:productionUuid')
    findAllByProduction(
        @Param('productionUuid') productionUuid: string
    ) {
        return this.productionFlowService.findAllByProduction(productionUuid);
    }

    @Patch(':uuid')
    update(
        @Param('uuid') uuid: string,
        @Body() updateDto: UpdateProductionFlowDto,
        @GetUser('sub') userId: string,
        @GetUser('storeUuid') storeUuid: string,
    ) {
        return this.productionFlowService.update(uuid, updateDto, userId, storeUuid);
    }

    @Delete(':uuid')
    remove(@Param('uuid') uuid: string) {
        return this.productionFlowService.remove(uuid);
    }
}