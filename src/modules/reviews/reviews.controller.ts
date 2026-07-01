import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ApiErrorResponse } from '../../common/swagger/api-response.models';
import { ImageFileValidationPipe } from '../media/pipes/image-file-validation.pipe';
import type { ValidatedImageFile } from '../media/pipes/image-file-validation.pipe';
import { CreateReviewDto } from './dto/create-review.dto';
import { DeleteReviewDto } from './dto/delete-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { UploadReviewImageDto } from './dto/upload-review-image.dto';
import { ReviewsService } from './reviews.service';

/**
 * Reviews & Ratings (Phase R2) — customer-facing review write API.
 *
 * There is no customer login: the delivered `orderId` is the proof of purchase
 * (create) and the proof of ownership (edit/delete). Customer identity is always
 * derived server-side from the order — never accepted from the request. New
 * reviews start PENDING; only PENDING reviews can be edited or deleted by the
 * customer, and an edit returns the review to PENDING for re-moderation.
 */
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a review for a purchased product or pack',
    description:
      'Creates a PENDING review for a Product or Pack the customer verifiably ' +
      'bought. Ownership and delivery are re-derived server-side from the given ' +
      'order (no customerId is accepted). A duplicate review for the same order ' +
      'and target is rejected. The author display name is generated and masked ' +
      'server-side; private customer/order data is never returned.',
  })
  @ApiCreatedResponse({ description: 'The created PENDING review (public-safe fields).' })
  @ApiBadRequestResponse({
    description: 'Invalid body, or the target is not part of the given order.',
    type: ApiErrorResponse,
  })
  @ApiForbiddenResponse({
    description: 'The order is not delivered or does not belong to the customer.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'The order was not found.', type: ApiErrorResponse })
  @ApiConflictResponse({
    description: 'A review already exists for this order and target.',
    type: ApiErrorResponse,
  })
  create(@Body() dto: CreateReviewDto) {
    return this.reviewsService.create(dto);
  }

  @Patch(':reviewId')
  @ApiOperation({
    summary: 'Edit a pending review',
    description:
      'Updates the content (rating/title/comment) of a still-PENDING review. ' +
      'The original order id must be supplied as ownership proof. Target, order, ' +
      'and customer cannot be changed. APPROVED or REJECTED reviews are locked. ' +
      'The edit keeps the review PENDING for re-moderation.',
  })
  @ApiParam({ name: 'reviewId', description: 'The review to edit.' })
  @ApiOkResponse({ description: 'The updated PENDING review.' })
  @ApiForbiddenResponse({
    description: 'Wrong order id, or the review is already moderated.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'The review was not found.', type: ApiErrorResponse })
  update(@Param('reviewId') reviewId: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(reviewId, dto);
  }

  @Delete(':reviewId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete a pending review',
    description:
      'Deletes a still-PENDING review. The original order id must be supplied ' +
      'as ownership proof (query parameter). APPROVED or REJECTED reviews are ' +
      'locked and cannot be deleted by the customer.',
  })
  @ApiParam({ name: 'reviewId', description: 'The review to delete.' })
  @ApiOkResponse({ description: 'The review was deleted.' })
  @ApiForbiddenResponse({
    description: 'Wrong order id, or the review is already moderated.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'The review was not found.', type: ApiErrorResponse })
  remove(@Param('reviewId') reviewId: string, @Query() query: DeleteReviewDto) {
    return this.reviewsService.remove(reviewId, query.orderId);
  }

  @Post(':reviewId/images')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Attach an image to a pending review',
    description:
      'Uploads one JPEG, PNG, or WEBP image and attaches it to a still-PENDING ' +
      'review (up to 5 per review). The original order id must be supplied as ' +
      'ownership proof. APPROVED or REJECTED reviews are locked. Images attached ' +
      'to a pending review are never shown publicly — they become visible only ' +
      'once the review is approved. Private storage keys are never returned.',
  })
  @ApiParam({ name: 'reviewId', description: 'The review to attach the image to.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'orderId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        orderId: {
          type: 'string',
          format: 'uuid',
          description: 'Ownership proof (the review’s original order).',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'The attached image (display-safe fields).' })
  @ApiBadRequestResponse({ description: 'Invalid or missing image file.', type: ApiErrorResponse })
  @ApiForbiddenResponse({
    description: 'Wrong order id, or the review is already moderated.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'The review was not found.', type: ApiErrorResponse })
  @ApiConflictResponse({
    description: 'The review already has the maximum number of images.',
    type: ApiErrorResponse,
  })
  @ApiPayloadTooLargeResponse({ description: 'Image file is too large.', type: ApiErrorResponse })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Unsupported or mismatched image type.',
    type: ApiErrorResponse,
  })
  addImage(
    @Param('reviewId') reviewId: string,
    @UploadedFile(ImageFileValidationPipe) file: ValidatedImageFile,
    @Body() dto: UploadReviewImageDto,
  ) {
    return this.reviewsService.addImage(reviewId, dto.orderId, file);
  }

  @Delete(':reviewId/images/:imageId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove an image from a pending review',
    description:
      'Detaches an image from a still-PENDING review. The original order id must ' +
      'be supplied as ownership proof (query parameter). APPROVED or REJECTED ' +
      'reviews are locked and their images cannot be changed by the customer.',
  })
  @ApiParam({ name: 'reviewId', description: 'The review that owns the image.' })
  @ApiParam({ name: 'imageId', description: 'The review image to remove.' })
  @ApiOkResponse({ description: 'The image was removed.' })
  @ApiForbiddenResponse({
    description: 'Wrong order id, or the review is already moderated.',
    type: ApiErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'The review or image was not found.',
    type: ApiErrorResponse,
  })
  removeImage(
    @Param('reviewId') reviewId: string,
    @Param('imageId') imageId: string,
    @Query() query: DeleteReviewDto,
  ) {
    return this.reviewsService.removeImage(reviewId, imageId, query.orderId);
  }
}
