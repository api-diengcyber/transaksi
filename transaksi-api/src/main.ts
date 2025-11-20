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
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Transaksi API Docs',
    customfavIcon:
      'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',

    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none', // collapse all endpoints
      displayRequestDuration: true,
      filter: true, // add search bar
      tryItOutEnabled: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },

    customCss: `
      body {
      }
      .swagger-ui .topbar {
      }
      .swagger-ui .topbar-wrapper img {
        content: url('https://cdn-icons-png.flaticon.com/512/3144/3144456.png');
        width: 40px;
        height: 40px;
      }
      .swagger-ui .topbar-wrapper {
        color: #e2e8f0 !important;
        font-weight: bold;
      }
      .swagger-ui .info {
        padding: 20px;
        border-radius: 10px;
      }
      .swagger-ui .info h1 {
        color: #38bdf8 !important;
      }
      .swagger-ui .model-box {
      }
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-thumb {
        background: #475569;
        border-radius: 10px;
      }
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
