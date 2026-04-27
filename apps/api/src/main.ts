import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseApiEnv } from '@sellline/shared';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const env = parseApiEnv();

  const app = await NestFactory.create(AppModule, {
    logger:
      env.NODE_ENV === 'development' ? ['log', 'warn', 'error', 'debug'] : ['log', 'warn', 'error'],
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: env.API_CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('sellline API')
      .setDescription('sellline-CRM backend')
      .setVersion('0.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(env.API_PORT);
  Logger.log(`API listening on ${env.API_PUBLIC_URL} (port ${env.API_PORT})`, 'Bootstrap');
  if (env.NODE_ENV !== 'production') {
    Logger.log(`Swagger: ${env.API_PUBLIC_URL}/api/docs`, 'Bootstrap');
  }
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] Fatal:', err);
  process.exit(1);
});
