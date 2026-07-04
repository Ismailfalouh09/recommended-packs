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

@ApiTags('Admin Pack Media')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/packs/:packId/images')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class PackMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Upload a pack image',
    description:
      'Uploads one JPEG, PNG, or WEBP image to Cloudinary and attaches it to a pack as COVER or GALLERY. New covers demote the previous cover to GALLERY.',
  })
  @ApiParam({ name: 'packId', description: 'Pack ID.' })
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
    description: 'Pack image uploaded.',
    type: MediaImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid file, metadata, or pack.' })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  upload(
    @Param('packId') packId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadMediaDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.uploadPackImage(packId, file, dto, currentAdmin);
  }

  @Patch('reorder')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Reorder pack images' })
  @ApiOkResponse({
    description: 'Pack images reordered.',
    type: [MediaImageResponse],
  })
  @ApiBadRequestResponse({ description: 'Invalid reorder payload.' })
  @ApiNotFoundResponse({ description: 'Pack not found.' })
  reorder(@Param('packId') packId: string, @Body() dto: ReorderMediaDto) {
    return this.mediaService.reorderPackImages(packId, dto);
  }

  @Patch(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Update pack image metadata' })
  @ApiOkResponse({
    description: 'Pack image updated.',
    type: MediaImageResponse,
  })
  @ApiNotFoundResponse({ description: 'Pack image not found.' })
  update(
    @Param('packId') packId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.mediaService.updatePackImage(packId, imageId, dto);
  }

  @Delete(':imageId')
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Delete a pack image' })
  @ApiOkResponse({ description: 'Pack image deleted.' })
  @ApiNotFoundResponse({ description: 'Pack image not found.' })
  delete(@Param('packId') packId: string, @Param('imageId') imageId: string) {
    return this.mediaService.deletePackImage(packId, imageId);
  }
}
