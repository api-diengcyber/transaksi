import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CourierService } from './courier.service';
import { AtGuard } from '../../common/guards/at.guard';
import { GetStore } from '../../common/decorators/get-store.decorator';

@Controller('courier')
@UseGuards(AtGuard)
export class CourierController {
  constructor(private readonly courierService: CourierService) { }

  @Get()
  findAll(@GetStore() storeId: string) {
    return this.courierService.findAll(storeId);
  }

  @Post()
  create(@Body('name') name: string, @GetStore() storeId: string) {
    return this.courierService.create(name, storeId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.courierService.delete(id);
  }

  @UseGuards(AtGuard)
  @Get('routes')
  findRoutes(@GetStore() storeId: string) {
    return this.courierService.findRoutes(storeId);
  }

  @UseGuards(AtGuard)
  @Post('routes')
  createRoute(
    @Body() body: { courier_uuid: string; origin: string; destination: string; price: number },
    @GetStore() storeId: string,
  ) {
    return this.courierService.createRoute(body, storeId);
  }
}