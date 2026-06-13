import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';
import { createOpenApiDocument } from '../src/common/swagger/openapi.config';

async function generateOpenApiFiles() {
  console.log('Creating Nest application for OpenAPI generation...');
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: ['error', 'warn'],
  });
  console.log('Generating OpenAPI document...');
  const document = createOpenApiDocument(app);
  const docsDir = join(process.cwd(), 'docs');
  const jsonPath = join(docsDir, 'openapi.json');
  const yamlPath = join(docsDir, 'openapi.yaml');

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await writeFile(yamlPath, stringify(document), 'utf8');
  await app.close();
  console.log('OpenAPI files written to docs/openapi.json and docs/openapi.yaml.');
}

generateOpenApiFiles().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? `OpenAPI generation failed: ${error.message}`
      : 'OpenAPI generation failed.',
  );
  process.exitCode = 1;
});
