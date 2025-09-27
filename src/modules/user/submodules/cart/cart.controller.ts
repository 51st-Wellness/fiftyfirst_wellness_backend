import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartItemWithRelations } from './dto/cart-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CartItem, User } from 'src/database/types';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('user/cart')
@UseGuards(RolesGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Add item to cart
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addToCart(
    @CurrentUser() user: User,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<ResponseDto<CartItemWithRelations>> {
    const cartItem = await this.cartService.addToCart(user.id, addToCartDto);

    return ResponseDto.createSuccessResponse(
      'Item added to cart successfully',
      cartItem,
    );
  }

  @Get('me')
  async getAuthenticatedUserCart(
    @CurrentUser() user: User,
  ): Promise<ResponseDto> {
    const items = await this.cartService.getAuthenticatedUserCart(user.id);

    return ResponseDto.createSuccessResponse('Cart retrieved successfully', {
      items,
    });
  }

  @Patch(':productId')
  async updateCartItem(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<ResponseDto<CartItemWithRelations>> {
    const cartItem = await this.cartService.updateCartItem(
      user.id,
      productId,
      updateCartItemDto,
    );

    return ResponseDto.createSuccessResponse(
      'Cart item updated successfully',
      cartItem,
    );
  }

  @Delete(':productId')
  async removeFromCart(
    @CurrentUser() user: User,
    @Param('productId') productId: string,
  ): Promise<ResponseDto<CartItem>> {
    const deletedItem = await this.cartService.removeFromCart(
      user.id,
      productId,
    );

    return ResponseDto.createSuccessResponse(
      'Item removed from cart successfully',
      deletedItem,
    );
  }

  // Clear entire cart
  @Delete()
  async clearCart(
    @CurrentUser() user: User,
  ): Promise<ResponseDto<{ deletedCount: number }>> {
    const result = await this.cartService.clearCart(user.id);

    return ResponseDto.createSuccessResponse(
      'Cart cleared successfully',
      result,
    );
  }
}
