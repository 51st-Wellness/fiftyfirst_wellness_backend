import { PaginationQueryDto } from 'src/lib/dto/pagination.dto';
import { OmitType } from '@nestjs/mapped-types';
export class CartQueryDto extends OmitType(PaginationQueryDto, [
  'sortOrder',
  'sortBy',
]) {}
