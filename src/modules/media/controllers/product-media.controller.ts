import {
  Body,
  Controller,
  Delete,
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
import { ReorderMediaDto } from '../dto/reorder-media.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaService } from '../media.service';
import { ImageFileValidationPipe } from '../pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../pipes/image-file-validation.pipe';

@ApiTags('Admin Product Media')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/products/:productId/images')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class ProductMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Upload a product image',
    description:
      'Uploads one JPEG, PNG, or WEBP image to Cloudinary and attaches it to a product as COVER or GALLERY. New covers demote the previous cover to GALLERY.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        role: { type: 'string', enum: ['COVER', 'GALLERY'] },
        altText: { type: 'string' },
        position: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Product image uploaded.',
    type: MediaImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid file, metadata, or product.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  upload(
    @Param('productId') productId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadMediaDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.uploadProductImage(
      productId,
      file,
      dto,
      currentAdmin,
    );
  }

  @Patch('reorder')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Reorder product images',
    description:
      'Updates product image display positions in a transaction. Duplicate IDs, duplicate positions, negative positions, and foreign images are rejected.',
  })
  @ApiOkResponse({
    description: 'Product images reordered.',
    type: [MediaImageResponse],
  })
  @ApiBadRequestResponse({ description: 'Invalid reorder payload.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  reorder(@Param('productId') productId: string, @Body() dto: ReorderMediaDto) {
    return this.mediaService.reorderProductImages(productId, dto);
  }

  @Patch(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update product image metadata',
    description:
      'Updates role, alt text, or position. Promoting an image to COVER demotes the previous cover.',
  })
  @ApiOkResponse({
    description: 'Product image updated.',
    type: MediaImageResponse,
  })
  @ApiNotFoundResponse({ description: 'Product image not found.' })
  update(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.updateProductImage(productId, imageId, dto);
  }

  @Delete(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a product image',
    description:
      'Deletes the product image relationship and removes the Cloudinary asset when no other relationship references it.',
  })
  @ApiOkResponse({ description: 'Product image deleted.' })
  @ApiNotFoundResponse({ description: 'Product image not found.' })
  delete(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.deleteProductImage(productId, imageId);
  }
}
