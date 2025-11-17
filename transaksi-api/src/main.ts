import { NestFactory } from '@nestjs/core';
import { AppModule } from './module/app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
  origin: [
    'http://localhost:3001', 
    'http://localhost:3000'
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Transaksi API')
    .setDescription('The transaksi API description')
    .setVersion('1.0.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);
  
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
