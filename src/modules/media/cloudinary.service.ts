import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadInput {
  buffer: Buffer;
  folder: string;
  originalName?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly hasCredentials: boolean;

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.hasCredentials = !!cloudName && !!apiKey && !!apiSecret;

    if (this.hasCredentials) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  async uploadImage(input: CloudinaryUploadInput): Promise<UploadApiResponse> {
    this.assertConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: input.folder,
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
          context: input.originalName
            ? { original_name: input.originalName }
            : undefined,
        },
        (error, result) => {
          if (error || !result) {
            reject(new BadGatewayException('Cloudinary image upload failed.'));
            return;
          }

          resolve(result);
        },
      );

      uploadStream.end(input.buffer);
    });
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
  }

  private assertConfigured(): void {
    if (!this.hasCredentials) {
      throw new ServiceUnavailableException(
        'Cloudinary credentials are not configured.',
      );
    }
  }
}
