import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { OmitType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddToCartDto } from 'src/modules/user/submodules/cart/dto/add-to-cart.dto';

export class SignupDto extends OmitType(CreateUserDto, [
  'bio',
  'profilePicture',
  'role',
]) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddToCartDto)
  cartItems?: AddToCartDto[];
}
