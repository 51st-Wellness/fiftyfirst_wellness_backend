import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartItemWithRelations } from './dto/cart-response.dto';
import { CartItem, ProductType } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // Add item to cart or update quantity if already exists
  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartItemWithRelations> {
    const { productId, quantity } = addToCartDto;

    // Check if product exists and is a store item
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        storeItem: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.type !== ProductType.STORE || !product.storeItem) {
      throw new BadRequestException('Only store items can be added to cart');
    }

    // Check if product is published
    if (!product.storeItem.isPublished) {
      throw new BadRequestException('Product is not available for purchase');
    }

    // Check stock availability
    if (product.storeItem.stock < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Check if item already exists in cart
    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    let cartItem: CartItem;

    if (existingCartItem) {
      // Update existing cart item quantity
      const newQuantity = existingCartItem.quantity + quantity;

      // Check if new quantity exceeds stock
      if (product.storeItem.stock < newQuantity) {
        throw new BadRequestException(
          'Cannot add more items than available stock',
        );
      }

      cartItem = await this.prisma.cartItem.update({
        where: {
          productId_userId: {
            productId,
            userId,
          },
        },
        data: {
          quantity: newQuantity,
        },
      });
    } else {
      // Create new cart item
      cartItem = await this.prisma.cartItem.create({
        data: {
          productId,
          userId,
          quantity,
        },
      });
    }

    // Return cart item with relations
    return this.getCartItemWithRelations(cartItem.id);
  }

  // Get all cart items for a user (no pagination)
  async getCart(userId: string): Promise<CartItemWithRelations[]> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            storeItem: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePicture: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return items as CartItemWithRelations[];
  }

  // Alias kept for compatibility
  async getCartAll(userId: string): Promise<CartItemWithRelations[]> {
    return this.getCart(userId);
  }

  // Update cart item quantity
  async updateCartItem(
    userId: string,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartItemWithRelations> {
    const { quantity } = updateCartItemDto;

    // Check if cart item exists
    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
      include: {
        product: {
          include: {
            storeItem: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Check stock availability
    if (
      cartItem.product.storeItem &&
      cartItem.product.storeItem.stock < quantity
    ) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Update cart item
    const updatedCartItem = await this.prisma.cartItem.update({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
      data: {
        quantity,
      },
    });

    return this.getCartItemWithRelations(updatedCartItem.id);
  }

  // Remove item from cart
  async removeFromCart(userId: string, productId: string): Promise<CartItem> {
    // Check if cart item exists
    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Delete cart item
    const deletedCartItem = await this.prisma.cartItem.delete({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    return deletedCartItem;
  }

  // Clear entire cart for user
  async clearCart(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.prisma.cartItem.deleteMany({
      where: {
        userId,
      },
    });

    return { deletedCount: result.count };
  }

  // Private helper method to get cart item with relations
  private async getCartItemWithRelations(
    cartItemId: string,
  ): Promise<CartItemWithRelations> {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        product: {
          include: {
            storeItem: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePicture: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    return cartItem as CartItemWithRelations;
  }
}
