import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { ProductResponse } from '../../common/swagger/api-response.models';
import { AdminRole, MediaRole, ProductStatus } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentAdminUser } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { MediaService } from '../media/media.service';
import { ImageFileValidationPipe } from '../media/pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../media/pipes/image-file-validation.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

type ProductCreateFiles = {
  coverImage?: Express.Multer.File[];
  images?: Express.Multer.File[];
  'images[]'?: Express.Multer.File[];
};

@ApiTags('Admin Products')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/products')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly mediaService: MediaService,
    private readonly imageFileValidationPipe: ImageFileValidationPipe,
  ) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List admin products',
    description:
      'OWNER, ADMIN, and STAFF can read paginated products with admin-only stock/count summaries.',
  })
  @ApiOkResponse({ description: 'Paginated products.', type: ProductResponse })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.adminFindAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get admin product details',
    description: 'OWNER, ADMIN, and STAFF can read full product details.',
  })
  @ApiOkResponse({ description: 'Product details.', type: ProductResponse })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findOne(@Param('id') id: string) {
    return this.productsService.adminFindOne(id);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverImage', maxCount: 1 },
        { name: 'images', maxCount: 20 },
        { name: 'images[]', maxCount: 20 },
      ],
      { storage: memoryStorage() },
    ),
  )
  @ApiOperation({
    summary: 'Create product',
    description:
      'OWNER and ADMIN can create catalog products. Optional multipart image fields attach a cover image and gallery images during creation.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['categoryId', 'name', 'slug', 'basePrice', 'currency'],
      properties: {
        categoryId: { type: 'string', format: 'uuid' },
        brandId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Foundation X' },
        slug: { type: 'string', example: 'foundation-x' },
        productType: { type: 'string', example: 'face-serum' },
        shortDescription: { type: 'string' },
        description: { type: 'string' },
        ingredients: { type: 'string' },
        directions: { type: 'string' },
        basePrice: { type: 'number', minimum: 0, example: 120 },
        compareAtPrice: { type: 'number', minimum: 0, example: 150 },
        costPrice: { type: 'number', minimum: 0, example: 70 },
        currency: { type: 'string', example: 'MAD' },
        metaTitle: { type: 'string' },
        metaDescription: { type: 'string' },
        mainImageUrl: { type: 'string', format: 'uri' },
        status: { type: 'string', enum: Object.values(ProductStatus) },
        isActive: { type: 'boolean', default: true },
        attributes: {
          type: 'string',
          description:
            'JSON-encoded ProductAttributeInputDto[] when using multipart/form-data.',
        },
        coverImage: { type: 'string', format: 'binary' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Product created.', type: ProductResponse })
  @ApiBadRequestResponse({ description: 'Invalid product or image payload.' })
  @ApiConflictResponse({ description: 'Product slug already exists.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: ProductCreateFiles | undefined,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    const coverImage = await this.validateOptionalImage(
      files?.coverImage?.[0],
    );
    const galleryImages = await Promise.all(
      [...(files?.images ?? []), ...(files?.['images[]'] ?? [])].map((file) =>
        this.validateOptionalImage(file),
      ),
    );

    const product = await this.productsService.adminCreate(dto);

    if (coverImage) {
      await this.mediaService.uploadProductImage(
        product.id,
        coverImage,
        { role: MediaRole.COVER },
        currentAdmin,
      );
    }

    for (const image of galleryImages) {
      if (!image) {
        continue;
      }

      await this.mediaService.uploadProductImage(
        product.id,
        image,
        { role: MediaRole.GALLERY },
        currentAdmin,
      );
    }

    return coverImage || galleryImages.length > 0
      ? this.productsService.adminFindOne(product.id)
      : product;
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product',
    description: 'OWNER and ADMIN can update mutable product fields.',
  })
  @ApiOkResponse({ description: 'Product updated.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Product slug already exists.' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Archive product',
    description:
      'OWNER and ADMIN can archive a product and deactivate its references.',
  })
  @ApiOkResponse({ description: 'Product archived.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  archive(@Param('id') id: string) {
    return this.productsService.adminArchive(id);
  }

  private async validateOptionalImage(
    file: Express.Multer.File | undefined,
  ): Promise<ValidatedImageFile | undefined> {
    return file ? this.imageFileValidationPipe.transform(file) : undefined;
  }
}
