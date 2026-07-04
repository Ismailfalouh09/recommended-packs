import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { ProductReferenceResponse } from '../../common/swagger/api-response.models';
import { AdminRole, VariationType } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentAdminUser } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { MediaService } from '../media/media.service';
import { ImageFileValidationPipe } from '../media/pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../media/pipes/image-file-validation.pipe';
import { CreateProductReferenceDto } from './dto/create-product-reference.dto';
import { QueryProductReferencesDto } from './dto/query-product-references.dto';
import { UpdateProductReferenceDto } from './dto/update-product-reference.dto';
import { UpdateReferenceStockDto } from './dto/update-reference-stock.dto';
import { ProductReferencesService } from './product-references.service';

@ApiTags('Admin Product References')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class AdminProductReferencesController {
  constructor(
    private readonly productReferencesService: ProductReferencesService,
    private readonly mediaService: MediaService,
    private readonly imageFileValidationPipe: ImageFileValidationPipe,
  ) {}

  @Get('admin/products/:productId/references')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List product references for a product',
    description: 'OWNER, ADMIN, and STAFF can read references for one product.',
  })
  @ApiOkResponse({
    description: 'Paginated product references.',
    type: ProductReferenceResponse,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findAllForProduct(
    @Param('productId') productId: string,
    @Query() query: QueryProductReferencesDto,
  ) {
    return this.productReferencesService.findAllForProduct(productId, query);
  }

  @Get('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get product reference details',
    description: 'OWNER, ADMIN, and STAFF can read product reference details.',
  })
  @ApiOkResponse({
    description: 'Product reference details.',
    type: ProductReferenceResponse,
  })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  findOne(@Param('id') id: string) {
    return this.productReferencesService.findOne(id);
  }

  @Post('admin/products/:productId/references')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('swatch', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Create product reference',
    description:
      'OWNER and ADMIN can create product references and compatibility attributes. Optional multipart swatch attaches the reference image during creation.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['referenceCode', 'referenceName'],
      properties: {
        referenceCode: { type: 'string', example: 'RF2' },
        referenceName: { type: 'string', example: 'Medium Warm' },
        shadeName: { type: 'string', nullable: true },
        shadeCode: { type: 'string', nullable: true },
        swatchHex: { type: 'string', example: '#E8B98C', nullable: true },
        measurement: { type: 'string', nullable: true },
        variationType: {
          type: 'string',
          enum: Object.values(VariationType),
          nullable: true,
        },
        barcode: { type: 'string', nullable: true },
        sku: { type: 'string', nullable: true },
        priceOverride: { type: 'number', minimum: 0, nullable: true },
        priceDelta: { type: 'number', default: 0 },
        imageUrl: { type: 'string', format: 'uri', nullable: true },
        stockQuantity: { type: 'integer', minimum: 0, default: 0 },
        reservedQuantity: { type: 'integer', minimum: 0, default: 0 },
        lowStockThreshold: { type: 'integer', minimum: 0, default: 5 },
        isDefault: { type: 'boolean', default: false },
        isActive: { type: 'boolean', default: true },
        attributes: {
          type: 'string',
          description:
            'JSON-encoded ReferenceAttributeInputDto[] when using multipart/form-data.',
        },
        swatch: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Product reference created.',
    type: ProductReferenceResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid reference or image payload.' })
  @ApiConflictResponse({
    description: 'Duplicate reference code, SKU, or barcode.',
  })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  async create(
    @Param('productId') productId: string,
    @Body() dto: CreateProductReferenceDto,
    @UploadedFile() swatchFile: Express.Multer.File | undefined,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    const swatch = await this.validateOptionalImage(swatchFile);
    const reference = await this.productReferencesService.create(
      productId,
      dto,
    );

    if (!swatch) {
      return reference;
    }

    await this.mediaService.replaceProductReferenceImage(
      reference.id,
      swatch,
      {},
      currentAdmin,
    );

    return this.productReferencesService.findOne(reference.id);
  }

  @Patch('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product reference',
    description:
      'OWNER and ADMIN can update references and replace compatibility attributes.',
  })
  @ApiOkResponse({ description: 'Product reference updated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  @ApiConflictResponse({
    description: 'Duplicate reference code, SKU, or barcode.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateProductReferenceDto) {
    return this.productReferencesService.update(id, dto);
  }

  @Patch('admin/product-references/:id/stock')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product reference stock counts',
    description:
      'OWNER and ADMIN can update stock, reserved quantity, and low-stock threshold. This does not reserve or deduct stock automatically.',
  })
  @ApiOkResponse({ description: 'Product reference stock updated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  updateStock(@Param('id') id: string, @Body() dto: UpdateReferenceStockDto) {
    return this.productReferencesService.updateStock(id, dto);
  }

  @Delete('admin/product-references/:id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Deactivate product reference',
    description: 'OWNER and ADMIN can soft-deactivate product references.',
  })
  @ApiOkResponse({ description: 'Product reference deactivated.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  deactivate(@Param('id') id: string) {
    return this.productReferencesService.deactivate(id);
  }

  private async validateOptionalImage(
    file: Express.Multer.File | undefined,
  ): Promise<ValidatedImageFile | undefined> {
    return file ? this.imageFileValidationPipe.transform(file) : undefined;
  }
}
