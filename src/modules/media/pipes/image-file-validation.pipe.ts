import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  allowedImageExtensions,
  allowedImageMimeTypes,
  defaultMediaMaxFileSizeMb,
} from '../constants/media.constants';
import { readCloudinaryMediaConfig } from '../providers/cloudinary.config';

export type ValidatedImageFile = Express.Multer.File & {
  detectedMimeType: (typeof allowedImageMimeTypes)[number];
  detectedExtension: (typeof allowedImageExtensions)[number];
};

@Injectable()
export class ImageFileValidationPipe implements PipeTransform<
  Express.Multer.File | undefined,
  Promise<ValidatedImageFile>
> {
  constructor(private readonly configService: ConfigService) {}

  async transform(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('Image file cannot be empty.');
    }

    const config = readCloudinaryMediaConfig(this.configService);
    const maxFileSizeMb = config.maxFileSizeMb || defaultMediaMaxFileSizeMb;
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

    if (file.size > maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `Image file must be ${maxFileSizeMb} MB or smaller.`,
      );
    }

    if (
      !allowedImageMimeTypes.includes(
        file.mimetype as (typeof allowedImageMimeTypes)[number],
      )
    ) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG, and WEBP images are allowed.',
      );
    }

    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);

    if (!detected) {
      throw new BadRequestException('Image file is invalid or corrupted.');
    }

    if (
      !allowedImageMimeTypes.includes(
        detected.mime as (typeof allowedImageMimeTypes)[number],
      ) ||
      !allowedImageExtensions.includes(
        detected.ext as (typeof allowedImageExtensions)[number],
      )
    ) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG, and WEBP images are allowed.',
      );
    }

    if (detected.mime !== file.mimetype) {
      throw new UnsupportedMediaTypeException(
        'Uploaded file MIME type does not match the image content.',
      );
    }

    return {
      ...file,
      detectedMimeType: detected.mime as (typeof allowedImageMimeTypes)[number],
      detectedExtension:
        detected.ext as (typeof allowedImageExtensions)[number],
    };
  }
}
