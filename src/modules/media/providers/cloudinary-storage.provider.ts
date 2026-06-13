import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { mediaUrlTransformations } from '../constants/media.constants';
import {
  MediaStorageProvider,
  MediaTransformation,
  StoredMedia,
  UploadImageInput,
} from './media-storage.provider';
import { readCloudinaryMediaConfig } from './cloudinary.config';

@Injectable()
export class CloudinaryStorageProvider
  extends MediaStorageProvider
  implements OnModuleInit
{
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private readonly cloudName?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(configService: ConfigService) {
    super();

    const config = readCloudinaryMediaConfig(configService);
    this.cloudName = config.cloudName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;

    if (this.isConfigured()) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Cloudinary media storage is not configured. Upload endpoints will return 503 until local credentials are provided.',
      );
    }
  }

  async uploadImage(input: UploadImageInput): Promise<StoredMedia> {
    this.assertConfigured();

    this.logger.log({
      operation: 'cloudinary_upload_started',
      folder: input.folder,
      publicId: input.publicId,
    });

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder,
          public_id: input.publicId,
          resource_type: 'image',
          overwrite: false,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(new BadGatewayException('Cloudinary image upload failed.'));
            return;
          }

          resolve(uploadResult);
        },
      );

      uploadStream.end(input.buffer);
    });

    this.logger.log({
      operation: 'cloudinary_upload_succeeded',
      publicId: result.public_id,
      providerAssetId: result.asset_id,
    });

    return {
      publicId: result.public_id,
      providerAssetId: result.asset_id,
      secureUrl: result.secure_url,
      url: result.url,
      resourceType: result.resource_type,
      format: result.format,
      mimeType: input.mimeType,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      version: result.version?.toString(),
    };
  }

  async deleteImage(publicId: string): Promise<void> {
    this.assertConfigured();

    await new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: 'image' },
        (error) => {
          if (error) {
            reject(
              new BadGatewayException('Cloudinary image deletion failed.'),
            );
            return;
          }

          resolve();
        },
      );
    });

    this.logger.log({
      operation: 'cloudinary_delete_succeeded',
      publicId,
    });
  }

  buildUrl(publicId: string, transformation: MediaTransformation): string {
    if (!this.cloudName) {
      return '';
    }

    const encodedPublicId = publicId
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${mediaUrlTransformations[transformation]}/${encodedPublicId}`;
  }

  private isConfigured() {
    return !!this.cloudName && !!this.apiKey && !!this.apiSecret;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Cloudinary credentials are not configured.',
      );
    }
  }
}
