import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SystemService } from './system.service';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus() {
    return {
      status: 'success',
      message: 'Server backend berjalan normal',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('logs')
  async getLogs() {
    return await this.systemService.getSystemLogs();
  }
}