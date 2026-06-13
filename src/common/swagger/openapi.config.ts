import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponse } from './api-response.models';

export const swaggerPath = 'api/docs';
export const swaggerJsonPath = 'api/docs-json';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('Beauty Pack Recommendation API')
    .setDescription(
      'Backend API for beauty-pack personalization, recommendations, COD orders, and administration',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the JWT access token returned by POST /auth/login.',
      },
      'bearer',
    )
    .addTag(
      'Health',
      'Minimal root endpoint for confirming the API is running.',
    )
    .addTag('Authentication', 'Admin login and current-admin identity.')
    .addTag('Attributes', 'Public active attribute groups and options.')
    .addTag('Quiz', 'Public quiz questions and customer profile creation.')
    .addTag('Products', 'Public active product catalog reads.')
    .addTag(
      'Product References',
      'Product reference data nested under products.',
    )
    .addTag('Packs', 'Public active pack reads.')
    .addTag('Recommendations', 'Recommendation generation and stored sessions.')
    .addTag(
      'Orders',
      'Customer COD order creation and safe order summary lookup.',
    )
    .addTag('Admin Categories', 'Protected category management.')
    .addTag('Admin Brands', 'Protected brand management.')
    .addTag('Admin Products', 'Protected product management.')
    .addTag(
      'Admin Product References',
      'Protected product reference management.',
    )
    .addTag('Admin Packs', 'Protected pack management.')
    .addTag(
      'Admin Attributes',
      'Protected attribute group and option management.',
    )
    .addTag('Admin Quiz', 'Protected quiz question management.')
    .addTag(
      'Admin Recommendation Rules',
      'Protected recommendation rule management and preview.',
    )
    .addTag('Admin Orders', 'Protected order inspection and status workflow.')
    .build();
}

export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, buildOpenApiConfig(), {
    extraModels: [ApiErrorResponse],
  });
}
