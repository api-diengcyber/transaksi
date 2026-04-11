import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SystemService } from 'src/module/system/system.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly systemService: SystemService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const ip = request.ip;
    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => {
          const delay = Date.now() - now;
          // Format Log: [INFO] GET /api/v1/products - 200 (15ms) - IP: 127.0.0.1
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          
          this.systemService.writeLog(`${method} ${url} - Status: ${statusCode} - IP: ${ip} - Time: ${delay}ms`, 'INFO');
        }),
      );
  }
}