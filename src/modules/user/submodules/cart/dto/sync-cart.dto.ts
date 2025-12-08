import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsArray, ValidateNested, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class SyncCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCartItemDto)
  items: SyncCartItemDto[];

  @IsOptional()
  @IsISO8601()
  localUpdatedAt?: string;
}

export interface SyncCartResponse {
  items: any[]; // CartItemWithRelations[]
  updatedAt: string | null;
  syncAction: 'local_wins' | 'server_wins' | 'no_change';
}
