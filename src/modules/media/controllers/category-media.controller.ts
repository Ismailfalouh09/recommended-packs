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

@ApiTags('Admin Category Media')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/categories/:categoryId/image')
@ApiUnauthorizedResponse({ description: 'Authentication required.' })
@ApiForbiddenResponse({ description: 'Insufficient admin role.' })
export class CategoryMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Put()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Create or replace a category image',
    description:
      'Uploads a new image, replaces the category image relationship transactionally, and then attempts to delete the old Cloudinary asset.',
  })
  @ApiParam({ name: 'categoryId', description: 'Category ID.' })
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
    description: 'Category image created or replaced.',
    type: MediaImageResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid file or metadata.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
  })
  replace(
    @Param('categoryId') categoryId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadSingleImageDto,
    @CurrentAdminUser() currentAdmin: CurrentAdmin,
  ) {
    return this.mediaService.replaceCategoryImage(
      categoryId,
      file,
      dto,
      currentAdmin,
    );
  }

  @Delete()
  @Roles(AdminRole.OWNER, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Delete a category image' })
  @ApiOkResponse({ description: 'Category image deleted.' })
  @ApiNotFoundResponse({ description: 'Category image not found.' })
  delete(@Param('categoryId') categoryId: string) {
    return this.mediaService.deleteCategoryImage(categoryId);
  }
}
