import { Controller, Post, Get, Body, UseGuards, BadRequestException, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { StoreService } from './store.service';
import { InstallStoreDto } from './dto/install-store.dto';
import { SaveSettingDto } from './dto/save-setting.dto'; // Import DTO baru
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { CreateStoreDto } from './dto/create-store.dto';

@ApiTags('Store')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // [REVISI KRITIS] Endpoint Install diubah untuk menerima file dan body JSON
  @Post('install')
  @ApiConsumes('multipart/form-data') // Wajib untuk menerima file
  @ApiOperation({ summary: 'Installs new store with optional logo upload' })
  @UseInterceptors(FileInterceptor('logo')) // 'logo' adalah field name dari frontend
  async install(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: InstallStoreDto,
  ) {
    let logoPath: string | null = null;
    if (file) {
      logoPath = `/uploads/${file.filename}`;
    }
    return this.storeService.installStore(body, logoPath, file?.originalname);
  }

  @Get('my-store')
  @UseGuards(AtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of user stores' })
  async getMyStores(
    @GetUser('sub') userId: string,
  ) {
    return this.storeService.getMyStores(userId, null);
  }

  @Post('save-setting')
  @UseGuards(AtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update store profile and settings' })
  async saveSettings(
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
    @Body() dto: SaveSettingDto
  ) {
    return this.storeService.saveSettings(userId, storeUuid, dto);
  }

  @Post('upload-logo')
  @UseGuards(AtGuard)
  @ApiConsumes('multipart/form-data') 
  @ApiOperation({ summary: 'Uploads store logo and updates logo URL in settings' })
  @UseInterceptors(FileInterceptor('file')) 
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File, 
    @GetStore() storeUuid: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    const uploadedPath = `/uploads/${file.filename}`;
    return this.storeService.updateStoreLogo(storeUuid, uploadedPath, file.originalname);
  }
  
  @Post('create')
  @UseGuards(AtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new branch/store for current user' })
  async createStore(
    @GetUser('sub') userId: string,
    @Body() dto: CreateStoreDto,
  ) {
    return this.storeService.createStore(userId, dto);
  }
}