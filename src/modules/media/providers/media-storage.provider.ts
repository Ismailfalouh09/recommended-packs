import { mediaUrlTransformations } from '../constants/media.constants';

export interface UploadImageInput {
  buffer: Buffer;
  mimeType: string;
  folder: string;
  publicId: string;
}

export interface StoredMedia {
  publicId: string;
  providerAssetId?: string;
  secureUrl: string;
  url?: string;
  resourceType: string;
  format?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  bytes?: number;
  version?: string;
}

export type MediaTransformation = keyof typeof mediaUrlTransformations;

export abstract class MediaStorageProvider {
  abstract uploadImage(input: UploadImageInput): Promise<StoredMedia>;

  abstract deleteImage(publicId: string): Promise<void>;

  abstract buildUrl(
    publicId: string,
    transformation: MediaTransformation,
  ): string;
}
