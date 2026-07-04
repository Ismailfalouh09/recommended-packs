import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { MediaImageResponse } from '../../../common/swagger/api-response.models';
import { CurrentAdminUser } from '../../auth/decorators/current-admin.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { CurrentAdmin } from '../../auth/types/jwt-payload.type';
import {
  UpdateReferenceGalleryImageDto,
  UploadReferenceGalleryImageDto,
} from '../dto/reference-gallery-image.dto';
import { ReorderMediaDto } from '../dto/reorder-media.dto';
import { MediaService } from '../media.service';
import { ImageFileValidationPipe } from '../pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../pipes/image-file-validation.pipe';

/**
 * Media Management (Task 14) — admin CRUD for the per-reference (per-shade)
 * gallery. This is separate from the single SWATCH image
 * (`/admin/product-references/:referenceId/image`) and the product-level gallery
 * (`/admin/products/:productId/images`).
 */
@ApiTags('Admin Product Reference Gallery')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/product-references/:referenceId/gallery-images')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class ProductReferenceGalleryMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List product reference gallery images',
    description:
      'OWNER, ADMIN, and STAFF can read the ordered gallery for one shade/reference.',
  })
  @ApiParam({ name: 'referenceId', description: 'Product reference ID.' })
  @ApiOkResponse({
    description: 'Reference gallery images ordered by position.',
    type: [MediaImageResponse],
  })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  list(@Param('referenceId') referenceId: string) {
    return this.mediaService.listProductReferenceGalleryImages(referenceId);
  }

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Add a product reference gallery image',
    description:
      'Uploads one JPEG, PNG, or WEBP image to Cloudinary and attaches it to a reference gallery. The first image uploaded for a reference automatically becomes the primary image.',
  })
  @ApiParam({ name: 'referenceId', description: 'Product reference ID.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string' },
        position: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Reference gallery image added.',
    type: MediaImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid file or metadata.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  upload(
    @Param('referenceId') referenceId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadReferenceGalleryImageDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.uploadProductReferenceGalleryImage(
      referenceId,
      file,
      dto,
      currentAdmin,
    );
  }

  @Patch('reorder')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Reorder product reference gallery images',
    description:
      'Updates gallery image display positions in a transaction. Duplicate IDs, duplicate positions, negative positions, and foreign images are rejected.',
  })
  @ApiOkResponse({
    description: 'Reference gallery images reordered.',
    type: [MediaImageResponse],
  })
  @ApiBadRequestResponse({ description: 'Invalid reorder payload.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  reorder(
    @Param('referenceId') referenceId: string,
    @Body() dto: ReorderMediaDto,
  ) {
    return this.mediaService.reorderProductReferenceGalleryImages(
      referenceId,
      dto,
    );
  }

  @Patch(':imageId/primary')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Set the primary product reference gallery image',
    description:
      'Promotes one gallery image to primary; the previous primary is unset in the same transaction.',
  })
  @ApiOkResponse({
    description: 'Reference gallery images after primary change.',
    type: [MediaImageResponse],
  })
  @ApiNotFoundResponse({ description: 'Reference gallery image not found.' })
  setPrimary(
    @Param('referenceId') referenceId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.setPrimaryProductReferenceGalleryImage(
      referenceId,
      imageId,
    );
  }

  @Patch(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product reference gallery image metadata',
    description: 'Updates alt text or display position of one gallery image.',
  })
  @ApiOkResponse({
    description: 'Reference gallery image updated.',
    type: MediaImageResponse,
  })
  @ApiNotFoundResponse({ description: 'Reference gallery image not found.' })
  update(
    @Param('referenceId') referenceId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateReferenceGalleryImageDto,
  ) {
    return this.mediaService.updateProductReferenceGalleryImage(
      referenceId,
      imageId,
      dto,
    );
  }

  @Delete(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a product reference gallery image',
    description:
      'Deletes the gallery image relationship and removes the Cloudinary asset when no other relationship references it. Deleting the primary image promotes the first remaining image by position.',
  })
  @ApiOkResponse({ description: 'Reference gallery image deleted.' })
  @ApiNotFoundResponse({ description: 'Reference gallery image not found.' })
  delete(
    @Param('referenceId') referenceId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.deleteProductReferenceGalleryImage(
      referenceId,
      imageId,
    );
  }
}
