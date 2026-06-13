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
  const adminDashboardOrigin = process.env.ADMIN_DASHBOARD_ORIGIN;

  if (adminDashboardOrigin) {
    app.enableCors({
      origin: adminDashboardOrigin,
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
