import { Controller, Post, Get, Delete, Body, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { diskStorage } from 'multer';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  async findAll(@Query('path') folderPath: string) {
    return this.mediaService.findAll(folderPath);
  }

  @Post('folder')
  async createFolder(@Body('path') folderPath: string, @Body('name') folderName: string) {
    return this.mediaService.createFolder(folderPath, folderName);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads', // Simpan sementara di root uploads
      filename: (req, file, cb) => cb(null, file.originalname)
    })
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('path') folderPath: string) {
    return this.mediaService.handleUpload(file, folderPath);
  }

  @Delete()
  async remove(@Query('path') targetPath: string) {
    return this.mediaService.remove(targetPath);
  }
}