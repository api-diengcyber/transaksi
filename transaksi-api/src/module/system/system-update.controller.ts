import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SystemUpdateService } from './system-update.service';
import { AtGuard } from 'src/common/guards/at.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as mysql from 'mysql2/promise';

@ApiTags('System Update')
@Controller('system-update')
export class SystemUpdateController {
  constructor(private readonly updateService: SystemUpdateService) {}

  @Get('check')
  @UseGuards(AtGuard)
  @ApiOperation({ summary: 'Periksa pembaruan di GitHub' })
  async check() {
    return await this.updateService.checkLatestVersion();
  }

	@Post('upgrade')
	@UseGuards(AtGuard)
	async upgrade(@Body('zipUrl') zipUrl: string, @Body('version') version: string) {
		return await this.updateService.executeUpdate(zipUrl, version);
	}

  @Post('test-db')
  @HttpCode(HttpStatus.OK)
  async testDatabaseConnection(@Body() body: any) {
    const { host, port, username, password, database } = body;

    try {
      // Mencoba membuat koneksi murni (sekali pakai) ke parameter yang dikirim frontend
      const connection = await mysql.createConnection({
        host: host,
        port: Number(port) || 3306,
        user: username,
        password: password || '',
        database: database,
      });

      // Tes ping untuk memastikan koneksi benar-benar hidup
      await connection.ping();
      
      // Tutup agar tidak terjadi kebocoran (memory leak)
      await connection.end();

      return { success: true, message: 'Koneksi ke database MySQL berhasil.' };
    } catch (error: any) { // Tambahkan :any agar tidak error TypeScript
      return { 
        success: false, 
        message: `Koneksi gagal: ${error.message}` 
      };
    }
  }
}