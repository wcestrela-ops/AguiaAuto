import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { validateSmsHubEnv } from './shared/config/env';
import { AppModule } from './app.module';

async function bootstrap() {
  validateSmsHubEnv();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1/sms');

  app.enableCors({
    origin: process.env.SMS_HUB_CORS_ORIGIN?.split(',') || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
    ],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AG SMS Hub API')
    .setDescription('API REST para gerenciamento e envio de comandos SMS')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.SMS_HUB_API_PORT || '4000', 10);
  await app.listen(port);
  console.log(`AG SMS Hub API listening on port ${port}`);
  console.log(`OpenAPI: http://localhost:${port}/api/docs`);
}

bootstrap();
