import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddToCartDto } from 'src/modules/user/submodules/cart/dto/add-to-cart.dto';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddToCartDto)
  cartItems?: AddToCartDto[];
}
