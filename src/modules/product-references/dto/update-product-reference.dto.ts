import { PartialType } from '@nestjs/swagger';
import { CreateProductReferenceDto } from './create-product-reference.dto';

export class UpdateProductReferenceDto extends PartialType(
  CreateProductReferenceDto,
) {}
