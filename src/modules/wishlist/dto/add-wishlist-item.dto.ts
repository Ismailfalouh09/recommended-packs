import { ApiProperty } from '@nestjs/swagger';
import { WishlistTargetType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class AddWishlistItemDto {
  @ApiProperty({
    description: 'Which kind of catalog entry to save.',
    enum: WishlistTargetType,
    example: WishlistTargetType.PRODUCT,
  })
  @IsEnum(WishlistTargetType)
  targetType: WishlistTargetType;

  @ApiProperty({
    description:
      'ID of the target to save. Must be an active, public Product when ' +
      'targetType is PRODUCT, or an active, public Pack when targetType is PACK.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  @IsUUID()
  targetId: string;
}
