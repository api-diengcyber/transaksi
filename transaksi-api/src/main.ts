import { NestFactory } from '@nestjs/core';
import { AppModule } from './module/app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());

  // ============================
  //     SWAGGER CONFIG
  // ============================
  const config = new DocumentBuilder()
    .setTitle('🛒 Transaksi API Documentation')
    .setDescription(`
<b>Transaksi API — Retail Management System</b><br/>
Dokumentasi interaktif untuk seluruh endpoint Master Data, Produk, Kategori, Transaksi, dan Laporan.<br/><br/>
<b>Gunakan tombol "Authorize" di kanan atas untuk login JWT.</b>
    `)
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Masukkan JWT token tanpa prefix "Bearer".',
      },
      'access-token',
    )
    .addServer('http://localhost:3000', 'Local Dev')
    .addServer('https://api.example.com', 'Production')
    .setContact(
      'Transaksi App Support',
      'https://example.com',
      'support@example.com',
    )
    .setLicense('MIT License', 'https://opensource.org/licenses/MIT')
    .setExternalDoc('Postman Collection', 'https://postman.com/example')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ============================
  //     CUSTOM SWAGGER UI
  // ============================
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
