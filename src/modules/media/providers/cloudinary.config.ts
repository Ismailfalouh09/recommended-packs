import { ConfigService } from '@nestjs/config';
import {
  defaultCloudinaryFolderPrefix,
  defaultMediaMaxFileSizeMb,
} from '../constants/media.constants';

export interface CloudinaryMediaConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  folderPrefix: string;
  maxFileSizeMb: number;
}

export function readCloudinaryMediaConfig(
  configService: ConfigService,
): CloudinaryMediaConfig {
  const maxFileSizeMb = Number(
    configService.get<string>('MEDIA_MAX_FILE_SIZE_MB') ??
      Number(configService.get<string>('MEDIA_MAX_FILE_SIZE_BYTES')) /
        (1024 * 1024),
  );

  return {
    cloudName: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
    apiKey: configService.get<string>('CLOUDINARY_API_KEY'),
    apiSecret: configService.get<string>('CLOUDINARY_API_SECRET'),
    folderPrefix:
      configService.get<string>('CLOUDINARY_FOLDER_PREFIX') ??
      configService.get<string>('CLOUDINARY_UPLOAD_FOLDER') ??
      defaultCloudinaryFolderPrefix,
    maxFileSizeMb: Number.isFinite(maxFileSizeMb)
      ? maxFileSizeMb
      : defaultMediaMaxFileSizeMb,
  };
}
