import {
  Body,
  Controller,
  Delete,
  Param,
  Put,
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
import { UploadSingleImageDto } from '../dto/upload-media.dto';
import { MediaService } from '../media.service';
import { ImageFileValidationPipe } from '../pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../pipes/image-file-validation.pipe';

@ApiTags('Admin Product Reference Media')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/product-references/:referenceId/image')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class ProductReferenceMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Put()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Create or replace a product reference image',
    description:
      'Uploads one shade/swatch image for a product reference. Replacement keeps the old relation until the new upload and database write succeed.',
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
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Product reference image created or replaced.',
    type: MediaImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid file or metadata.' })
  @ApiNotFoundResponse({ description: 'Product reference not found.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  replace(
    @Param('referenceId') referenceId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadSingleImageDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.replaceProductReferenceImage(
      referenceId,
      file,
      dto,
      currentAdmin,
    );
  }

  @Delete()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Delete a product reference image' })
  @ApiOkResponse({ description: 'Product reference image deleted.' })
  @ApiNotFoundResponse({ description: 'Product reference image not found.' })
  delete(@Param('referenceId') referenceId: string) {
    return this.mediaService.deleteProductReferenceImage(referenceId);
  }
}
