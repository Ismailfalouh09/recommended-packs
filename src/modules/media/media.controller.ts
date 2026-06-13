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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { MediaAssetResponse } from '../../common/swagger/api-response.models';
import { CurrentAdminUser } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { QueryMediaAssetsDto } from './dto/query-media-assets.dto';
import { UpdateMediaAssetDto } from './dto/update-media-asset.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService } from './media.service';

@ApiTags('Admin Media')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/media')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload an image asset',
    description:
      'OWNER and ADMIN can upload JPEG, PNG, WEBP, or AVIF images to Cloudinary. Metadata is stored locally for later product/pack attachment workflows.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload.',
        },
        folder: {
          type: 'string',
          example: 'recommended-packs/products',
        },
        altText: {
          type: 'string',
          example: 'Foundation bottle shade medium warm',
        },
        usageContext: {
          type: 'string',
          example: 'PRODUCT_MAIN_IMAGE',
        },
        relatedEntity: {
          type: 'string',
          example: 'PRODUCT',
        },
        relatedEntityId: {
          type: 'string',
          format: 'uuid',
          example: '00000000-0000-4000-8000-000000000001',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Image uploaded.',
    type: MediaAssetResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Missing file, invalid image type, invalid metadata, or file too large.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Cloudinary credentials are not configured.',
  })
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.uploadImage(file, dto, currentAdmin);
  }

  @Get()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'List media assets',
    description:
      'OWNER, ADMIN, and STAFF can list uploaded media assets. Deleted assets are hidden unless includeDeleted is true.',
  })
  @ApiOkResponse({ description: 'Paginated media assets.' })
  findAll(@Query() query: QueryMediaAssetsDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF)
  @ApiOperation({
    summary: 'Get media asset details',
    description: 'OWNER, ADMIN, and STAFF can inspect one active media asset.',
  })
  @ApiParam({
    name: 'id',
    description: 'Media asset ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Media asset details.',
    type: MediaAssetResponse,
  })
  @ApiNotFoundResponse({ description: 'Media asset not found.' })
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Update media asset metadata',
    description:
      'OWNER and ADMIN can update local metadata only. This does not replace the uploaded Cloudinary asset.',
  })
  @ApiParam({
    name: 'id',
    description: 'Media asset ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Media asset updated.',
    type: MediaAssetResponse,
  })
  @ApiNotFoundResponse({ description: 'Media asset not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateMediaAssetDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a media asset',
    description:
      'OWNER and ADMIN can delete the Cloudinary image and mark the local media record as deleted. This does not remove historical references from existing records.',
  })
  @ApiParam({
    name: 'id',
    description: 'Media asset ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @ApiOkResponse({
    description: 'Media asset deleted.',
    type: MediaAssetResponse,
  })
  @ApiNotFoundResponse({ description: 'Media asset not found.' })
  @ApiServiceUnavailableResponse({
    description: 'Cloudinary credentials are not configured.',
  })
  delete(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }
}
