import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreService } from './store.service';

@ApiTags('Public') // Tag khusus untuk endpoint tanpa auth
@Controller('public')
export class StorePublicController {
  constructor(private readonly storeService: StoreService) {}

  @Get('setup-status')
	@ApiOperation({ summary: 'Mengecek status toko dan mengambil konfigurasi tampilan' })
	async getSetupStatus() {
    const stores = await this.storeService.findAllPublic();
    
    if (stores.length === 0) {
        return { exists: false, store: null, settings: {} };
    }

    const store = stores[0];

    return {
        exists: true,
        store: store,
    };
  }
}