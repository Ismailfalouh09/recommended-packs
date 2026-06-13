import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type OpenApiDocument = {
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

const httpMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
]);

function fail(message: string): never {
  throw new Error(message);
}

function operationEntries(document: OpenApiDocument) {
  return Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
    Object.entries(pathItem)
      .filter(([method]) => httpMethods.has(method))
      .map(([method, operation]) => ({
        path,
        method,
        operation: operation as Record<string, unknown>,
      })),
  );
}

async function verifyOpenApi() {
  const openApiPath = join(process.cwd(), 'docs', 'openapi.json');
  const document = JSON.parse(
    await readFile(openApiPath, 'utf8'),
  ) as OpenApiDocument;
  const operations = operationEntries(document);

  if (operations.length === 0) {
    fail('OpenAPI document contains no operations.');
  }

  const missingSummary = operations.filter(
    ({ operation }) => typeof operation.summary !== 'string',
  );
  if (missingSummary.length > 0) {
    fail(
      `Operations missing summaries: ${missingSummary
        .map(({ method, path }) => `${method.toUpperCase()} ${path}`)
        .join(', ')}`,
    );
  }

  const unsecuredAdminRoutes = operations.filter(({ path, operation }) => {
    if (!path.startsWith('/admin') && path !== '/auth/me') {
      return false;
    }

    return !Array.isArray(operation.security);
  });

  if (unsecuredAdminRoutes.length > 0) {
    fail(
      `Protected routes missing bearer security: ${unsecuredAdminRoutes
        .map(({ method, path }) => `${method.toUpperCase()} ${path}`)
        .join(', ')}`,
    );
  }

  const schemas = document.components?.schemas ?? {};
  for (const requiredSchema of [
    'LoginDto',
    'CreateCustomerProfileDto',
    'CreateRecommendationDto',
    'CreateOrderDto',
    'UpdateOrderStatusDto',
    'AuthLoginResponse',
    'RecommendationResponse',
    'AdminOrderDetailsResponse',
    'ApiErrorResponse',
  ]) {
    if (!schemas[requiredSchema]) {
      fail(`Missing expected schema: ${requiredSchema}`);
    }
  }

  const serialized = JSON.stringify(document);
  for (const forbidden of ['passwordHash', 'JWT_SECRET', 'DATABASE_URL']) {
    if (serialized.includes(forbidden)) {
      fail(`Forbidden sensitive string found in OpenAPI document: ${forbidden}`);
    }
  }
}

verifyOpenApi().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
