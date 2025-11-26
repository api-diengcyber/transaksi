import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { UpdateProductionDto } from './dto/update-production.dto';
import { AtGuard } from 'src/common/guards/at.guard'; // Asumsi path Guard
import { GetUser } from 'src/common/decorators/get-user.decorator'; // Asumsi path Decorator


@UseGuards(AtGuard)
@Controller('production')
export class ProductionController {
    constructor(private readonly productionService: ProductionService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Body() createProductionDto: CreateProductionDto,
        @GetUser('sub') userId: string,
        @GetUser('storeUuid') storeUuid: string,
    ) {
        return this.productionService.create(createProductionDto, userId, storeUuid);
    }

    @Get()
    findAll() {
        return this.productionService.findAll();
    }

    @Get(':uuid')
    findOne(@Param('uuid') uuid: string) {
        return this.productionService.findOne(uuid);
    }

    @Patch(':uuid')
    update(
        @Param('uuid') uuid: string,
        @Body() updateProductionDto: UpdateProductionDto,
        @GetUser('sub') userId: string,
    ) {
        return this.productionService.update(
            uuid,
            updateProductionDto,
            userId,
        );
    }

    @Delete(':uuid')
    @HttpCode(HttpStatus.NO_CONTENT) // Mengembalikan 204 No Content untuk operasi delete berhasil
    remove(
        @Param('uuid') uuid: string,
        @GetUser('sub') userId: string,
    ) {
        return this.productionService.remove(uuid, userId);
    }
}