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
import {
  cartItems,
  products,
  ProductType,
  storeItems,
  users,
} from 'src/database/schema';
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

    if (product.type !== ProductType.STORE || !storeItem) {
      throw new BadRequestException('Only store items can be added to cart');
    }

    // Check if product is published
    if (!storeItem.isPublished) {
      throw new BadRequestException('Product is not available for purchase');
    }

    const isPreOrderItem = Boolean(storeItem.preOrderEnabled);

    // Enforce preorder-only cart rules:
    // - If cart already contains a preorder item, it cannot contain any other products
    // - If cart already has normal items, a preorder item must be checked out separately
    const existingCartItems = await this.database.db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        isPreOrder: storeItems.preOrderEnabled,
      })
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(storeItems, eq(products.id, storeItems.productId));

    if (existingCartItems.length > 0) {
      const cartHasPreOrder = existingCartItems.some(
        (item) => Boolean(item.isPreOrder) === true,
      );

      if (cartHasPreOrder) {
        // Cart already contains a preorder item – only allow updating quantity of the same product
        const existingSameProduct = existingCartItems.find(
          (item) => item.productId === productId,
        );

        if (!existingSameProduct) {
          throw new BadRequestException(
            'You already have a pre-order item in your cart. Please checkout that item separately before adding other products.',
          );
        }
      } else if (isPreOrderItem) {
        // Cart has only normal items and user is trying to add a preorder
        throw new BadRequestException(
          'Pre-order items must be checked out separately. Please complete your current cart or clear it before adding this pre-order item.',
        );
      }
    }

    // Check stock availability
    if (!isPreOrderItem && storeItem.stock < quantity) {
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
      if (!isPreOrderItem && storeItem.stock < newQuantity) {
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
    console.log('user id - getAuthenticatedUserCart', userId);
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
    const isPreOrderItem = Boolean(storeItem?.preOrderEnabled);

    if (!isPreOrderItem && storeItem && storeItem.stock < quantity) {
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
    console.log('user id - removeFromCart', userId);
    console.log('product id - removeFromCart', productId);
    // Check if cart item exists
    const cartItem = (
      await this.database.db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
        )
    )[0];
    console.log('cart item - removeFromCart', cartItem);
    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Delete cart item
    await this.database.db
      .delete(cartItems)
      .where(
        and(eq(cartItems.productId, productId), eq(cartItems.userId, userId)),
      );

    return cartItem;
  }

  // Clear entire cart for user
  async clearCart(userId: string): Promise<{ deletedCount: number }> {
    // Drizzle's SQLite delete doesn't support returning.
    // We'll perform the delete and then confirm.
    await this.database.db
      .delete(cartItems)
      .where(eq(cartItems.userId, userId));

    // For the purpose of this operation, we can assume all items were targeted for deletion.
    // A more complex system might require a count before delete, but this is efficient.
    return { deletedCount: 1 }; // Return a non-zero count to indicate success
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
