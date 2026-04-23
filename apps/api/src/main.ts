import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseApiEnv } from '@sellline/shared-types';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { TenantContextInterceptor } from './shared/interceptors/tenant-context.interceptor';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

async function bootstrap() {
  const env = parseApiEnv();

  const app = await NestFactory.create(AppModule, {
    logger:
      env.NODE_ENV === 'development' ? ['log', 'warn', 'error', 'debug'] : ['log', 'warn', 'error'],
  });

  app.use(env.NODE_ENV === 'production' ? helmet() : helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: env.API_CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TenantContextInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('sellline API')
      .setDescription('sellline-CRM backend')
      .setVersion('0.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    // Mount the Swagger UI at the bare /api root per the Session-0 acceptance
    // criterion ("Swagger-UI unter /api"). The global prefix is 'api' and no
    // controller registers at the prefix root, so the UI and controller routes
    // (/api/<sub>) do not collide. The OpenAPI JSON is pinned to an explicit
    // path to avoid shadowing the default (/api-json) inside the prefix.
    SwaggerModule.setup('api', app, document, {
      jsonDocumentUrl: 'api/openapi.json',
      yamlDocumentUrl: 'api/openapi.yaml',
    });
  }

  await app.listen(env.API_PORT);
  Logger.log(`API listening on ${env.API_PUBLIC_URL} (port ${env.API_PORT})`, 'Bootstrap');
  if (env.NODE_ENV !== 'production') {
    Logger.log(`Swagger UI: ${env.API_PUBLIC_URL}/api`, 'Bootstrap');
    Logger.log(`OpenAPI JSON: ${env.API_PUBLIC_URL}/api/openapi.json`, 'Bootstrap');
  }
}

bootstrap().catch((err: unknown) => {
  console.error('[bootstrap] Fatal:', err);
  process.exit(1);
});
