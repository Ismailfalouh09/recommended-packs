import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CategoryMediaController } from './controllers/category-media.controller';
import { PackMediaController } from './controllers/pack-media.controller';
import { ProductMediaController } from './controllers/product-media.controller';
import { ProductReferenceGalleryMediaController } from './controllers/product-reference-gallery-media.controller';
import { ProductReferenceMediaController } from './controllers/product-reference-media.controller';
import { MediaController } from './media.controller';
import { MediaUrlService } from './media-url.service';
import { MediaService } from './media.service';
import { ImageFileValidationPipe } from './pipes/image-file-validation.pipe';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { MediaStorageProvider } from './providers/media-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [
    MediaController,
    ProductMediaController,
    PackMediaController,
    CategoryMediaController,
    ProductReferenceMediaController,
    ProductReferenceGalleryMediaController,
  ],
  providers: [
    MediaService,
    MediaUrlService,
    ImageFileValidationPipe,
    { provide: MediaStorageProvider, useClass: CloudinaryStorageProvider },
  ],
  exports: [MediaUrlService, MediaService, ImageFileValidationPipe],
})
export class MediaModule {}
