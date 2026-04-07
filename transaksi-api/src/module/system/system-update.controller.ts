import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SystemUpdateService } from './system-update.service';
import { AtGuard } from 'src/common/guards/at.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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
}