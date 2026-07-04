export const allowedImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'] as const;

export const defaultMediaMaxFileSizeMb = 5;

/**
 * Maximum number of customer-attached images per review (Phase R2.5). Uploads
 * beyond this are rejected; enforced both up front and inside the write
 * transaction to stay race-safe.
 */
export const maxReviewImages = 5;

export const defaultCloudinaryFolderPrefix = 'beauty-app';

export const mediaUrlTransformations = {
  thumbnail: 'c_fill,g_auto,w_200,h_200,q_auto,f_auto',
  card: 'c_fill,g_auto,w_600,h_600,q_auto,f_auto',
  detail: 'c_limit,w_1200,h_1200,q_auto,f_auto',
  swatch: 'c_fill,w_300,h_300,q_auto,f_auto',
} as const;

export type MediaUrlVariant = keyof typeof mediaUrlTransformations;
