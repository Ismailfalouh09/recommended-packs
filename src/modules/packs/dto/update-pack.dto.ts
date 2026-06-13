import { PartialType } from '@nestjs/swagger';
import { CreatePackDto } from './create-pack.dto';

export class UpdatePackDto extends PartialType(CreatePackDto) {}
