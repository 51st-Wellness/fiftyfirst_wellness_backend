import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartItemWithRelations } from './dto/cart-response.dto';
import { eq, and, desc } from 'drizzle-orm';
import { cartItems, products, storeItems, users } from 'src/database/schema';
import { CartItem } from 'src/database/types';
import { generateId } from 'src/database/utils';

@Injectable()
export class CartService {
  constructor(private readonly database: DatabaseService) {}

  // Add item to cart or update quantity if already exists
  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartItemWithRelations> {
    const { productId, quantity } = addToCartDto;

    // Check if product exists and is a store item
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    let storeItem: any = null;
    if (product) {
      storeItem =
        (
          await this.database.db
            .select()
            .from(storeItems)
            .where(eq(storeItems.productId, productId))
        )[0] || null;
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.type !== 'STORE' || !storeItem) {
      throw new BadRequestException('Only store items can be added to cart');
    }

    // Check if product is published
    if (!storeItem.isPublished) {
      throw new BadRequestException('Product is not available for purchase');
    }

    // Check stock availability
    if (storeItem.stock < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Check if item already exists in cart
    const existingCartItem = (
      await this.database.db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
    )[0];

    let cartItem: CartItem;

    if (existingCartItem) {
      // Update existing cart item quantity
      const newQuantity = existingCartItem.quantity + quantity;

      // Check if new quantity exceeds stock
      if (storeItem.stock < newQuantity) {
        throw new BadRequestException(
          'Cannot add more items than available stock',
        );
      }

      cartItem = (
        await this.database.db
          .update(cartItems)
          .set({ quantity: newQuantity })
          .where(
            and(
              eq(cartItems.productId, productId),
              eq(cartItems.userId, userId),
            ),
          )
          .returning()
      )[0];
    } else {
      // Create new cart item
      cartItem = (
        await this.database.db
          .insert(cartItems)
          .values({
            id: generateId(),
            productId,
            userId,
            quantity,
          })
          .returning()
      )[0];
    }

    // Return cart item with relations
    return this.getCartItemWithRelations(cartItem.id);
  }

  // Get all cart items for a user (no pagination)
  async getAuthenticatedUserCart(
    userId: string,
  ): Promise<CartItemWithRelations[]> {
    const items = await this.database.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.id));

    // Enrich with product and user data
    const enrichedItems: CartItemWithRelations[] = [];
    for (const item of items) {
      const product = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
      )[0];

      const storeItem = (
        await this.database.db
          .select()
          .from(storeItems)
          .where(eq(storeItems.productId, item.productId))
      )[0];

      const user = (
        await this.database.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            profilePicture: users.profilePicture,
            isActive: users.isActive,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.id, userId))
      )[0];

      enrichedItems.push({
        ...item,
        product: {
          ...product,
          storeItem,
        },
        user,
      } as CartItemWithRelations);
    }

    return enrichedItems;
  }

  // Alias kept for compatibility
  async getCartAll(userId: string): Promise<CartItemWithRelations[]> {
    return this.getAuthenticatedUserCart(userId);
  }

  // Update cart item quantity
  async updateCartItem(
    userId: string,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartItemWithRelations> {
    const { quantity } = updateCartItemDto;

    // Check if cart item exists
    const cartItem = (
      await this.database.db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
    )[0];

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Get store item for stock check
    const storeItem = (
      await this.database.db
        .select()
        .from(storeItems)
        .where(eq(storeItems.productId, productId))
    )[0];

    // Check stock availability
    if (storeItem && storeItem.stock < quantity) {
      throw new BadRequestException('Insufficient stock available');
    }

    // Update cart item
    const updatedCartItem = (
      await this.database.db
        .update(cartItems)
        .set({ quantity })
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
        .returning()
    )[0];

    return this.getCartItemWithRelations(updatedCartItem.id);
  }

  // Remove item from cart
  async removeFromCart(userId: string, productId: string): Promise<CartItem> {
    // Check if cart item exists
    const cartItem = (
      await this.database.db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
    )[0];

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Delete cart item
    const deletedCartItem = (
      await this.database.db
        .delete(cartItems)
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
        .returning()
    )[0];

    return deletedCartItem;
  }

  // Clear entire cart for user
  async clearCart(userId: string): Promise<{ deletedCount: number }> {
    const itemsToDelete = await this.database.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId));

    await this.database.db
      .delete(cartItems)
      .where(eq(cartItems.userId, userId));

    return { deletedCount: itemsToDelete.length };
  }

  // Private helper method to get cart item with relations
  private async getCartItemWithRelations(
    cartItemId: string,
  ): Promise<CartItemWithRelations> {
    const cartItem = (
      await this.database.db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, cartItemId))
    )[0];

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, cartItem.productId))
    )[0];

    const storeItem = (
      await this.database.db
        .select()
        .from(storeItems)
        .where(eq(storeItems.productId, cartItem.productId))
    )[0];

    const user = (
      await this.database.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          profilePicture: users.profilePicture,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, cartItem.userId))
    )[0];

    return {
      ...cartItem,
      product: {
        ...product,
        storeItem,
      },
      user,
    } as CartItemWithRelations;
  }
}
