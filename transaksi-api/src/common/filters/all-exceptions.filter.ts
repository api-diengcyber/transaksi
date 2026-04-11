import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { SystemService } from 'src/module/system/system.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly systemService: SystemService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Tentukan apakah ini HttpException (seperti NotFound, BadRequest) atau error server tidak terduga
    const status = exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
        ? exception.message
        : (exception as Error)?.message || 'Internal Server Error';

    // Tulis ke file log kita
    this.systemService.writeLog(`[API ERROR] ${request.method} ${request.url} - Status: ${status} - Pesan: ${message}`, 'ERROR');

    // Kembalikan response JSON ke frontend
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    });
  }
}