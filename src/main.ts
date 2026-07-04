import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  createOpenApiDocument,
  swaggerJsonPath,
  swaggerPath,
} from './common/swagger/openapi.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = [
    process.env.ADMIN_DASHBOARD_ORIGIN,
    process.env.STORE_FRONTEND_ORIGIN,
  ]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerDocument = createOpenApiDocument(app);
  SwaggerModule.setup(swaggerPath, app, swaggerDocument, {
    jsonDocumentUrl: swaggerJsonPath,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
