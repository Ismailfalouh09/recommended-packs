import { Injectable } from '@nestjs/common';
import { MediaAsset } from '@prisma/client';
import {
  MediaStorageProvider,
  MediaTransformation,
} from './providers/media-storage.provider';

export interface MediaUrls {
  original: string;
  thumbnail: string;
  card: string;
  detail: string;
  swatch?: string;
}

@Injectable()
export class MediaUrlService {
  constructor(private readonly storageProvider: MediaStorageProvider) {}

  buildUrls(
    media: Pick<MediaAsset, 'publicId' | 'secureUrl'>,
    options?: { includeSwatch?: boolean },
  ): MediaUrls {
    const thumbnail = this.urlOrOriginal(media, 'thumbnail');
    const card = this.urlOrOriginal(media, 'card');
    const detail = this.urlOrOriginal(media, 'detail');

    return {
      original: media.secureUrl,
      thumbnail,
      card,
      detail,
      ...(options?.includeSwatch
        ? { swatch: this.urlOrOriginal(media, 'swatch') }
        : {}),
    };
  }

  private urlOrOriginal(
    media: Pick<MediaAsset, 'publicId' | 'secureUrl'>,
    transformation: MediaTransformation,
  ) {
    return (
      this.storageProvider.buildUrl(media.publicId, transformation) ||
      media.secureUrl
    );
  }
}
