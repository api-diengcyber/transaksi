import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}
}
