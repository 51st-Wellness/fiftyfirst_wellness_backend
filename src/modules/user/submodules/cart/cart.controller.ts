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
import { CartItem } from 'src/database/types';
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
    @CurrentUser('id') userId: string,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<ResponseDto<CartItemWithRelations>> {
    const cartItem = await this.cartService.addToCart(userId, addToCartDto);

    return ResponseDto.createSuccessResponse(
      'Item added to cart successfully',
      cartItem,
    );
  }

  @Get('me')
  async getAuthenticatedUserCart(
    @CurrentUser('id') userId: string,
  ): Promise<ResponseDto> {
    const items = await this.cartService.getAuthenticatedUserCart(userId);

    return ResponseDto.createSuccessResponse('Cart retrieved successfully', {
      items,
    });
  }

  @Patch(':productId')
  async updateCartItem(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<ResponseDto<CartItemWithRelations>> {
    const cartItem = await this.cartService.updateCartItem(
      userId,
      productId,
      updateCartItemDto,
    );

    return ResponseDto.createSuccessResponse(
      'Cart item updated successfully',
      cartItem,
    );
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromCart(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ): Promise<ResponseDto<CartItem>> {
    const deletedItem = await this.cartService.removeFromCart(
      userId,
      productId,
    );

    return ResponseDto.createSuccessResponse(
      'Item removed from cart successfully',
      deletedItem,
    );
  }

  // Clear entire cart
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(@CurrentUser('id') userId: string): Promise<{
    message: string;
    data: { deletedCount: number };
  }> {
    const result = await this.cartService.clearCart(userId);

    return {
      message: 'Cart cleared successfully',
      data: result,
    };
  }
}
