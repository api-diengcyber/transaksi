import { Injectable, LoggerService } from '@nestjs/common';
import { SystemService } from './system.service';

@Injectable()
export class SystemLogService implements LoggerService {

  constructor(
    private readonly systemService: SystemService
  ) {}

  log(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    this.systemService.writeLog(message, "INFO");
    console.log(`[NestJS Info]`, message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    this.systemService.writeLog(message, 'ERROR');
    console.error(`[NestJS Error]`, message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    this.systemService.writeLog(message, 'WARN');
    console.warn(`[NestJS Warn]`, message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    this.systemService.writeLog(message, 'DEBUG');
    console.debug(`[NestJS Debug]`, message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    const context = optionalParams[optionalParams.length - 1];
    this.systemService.writeLog(message, 'VERBOSE');
    console.log(`[NestJS Verbose]`, message, ...optionalParams);
  }

  async getSystemLogs() {
  }
}