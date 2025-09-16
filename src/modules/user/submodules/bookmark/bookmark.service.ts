import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { BookmarkQueryDto } from './dto/bookmark-query.dto';
import { BookmarkWithRelations } from './dto/bookmark-response.dto';
import { eq, and, or, like, desc, count } from 'drizzle-orm';
import {
  bookmarks,
  products,
  storeItems,
  programmes,
  podcasts,
  users,
} from 'src/database/schema';
import { Bookmark } from 'src/database/types';
import { generateId } from 'src/database/utils';

@Injectable()
export class BookmarkService {
  constructor(private readonly database: DatabaseService) {}

  // Create a new bookmark
  async create(
    userId: string,
    createBookmarkDto: CreateBookmarkDto,
  ): Promise<BookmarkWithRelations> {
    const { productId } = createBookmarkDto;

    // Check if product exists
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if bookmark already exists
    const existingBookmark = (
      await this.database.db
        .select()
        .from(bookmarks)
        .where(
          and(eq(bookmarks.productId, productId), eq(bookmarks.userId, userId)),
        )
    )[0];

    if (existingBookmark) {
      throw new ConflictException('Product is already bookmarked');
    }

    // Create bookmark
    const bookmark = (
      await this.database.db
        .insert(bookmarks)
        .values({
          id: generateId(),
          productId,
          userId,
        })
        .returning()
    )[0];

    return this.getBookmarkWithRelations(bookmark.id);
  }

  // Find all bookmarks for a user with pagination and filters
  async findAll(
    userId: string,
    query: BookmarkQueryDto,
  ): Promise<{ bookmarks: BookmarkWithRelations[]; total: number }> {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    let bookmarkQuery = this.database.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .$dynamic();

    // If search is provided, filter by joining with product tables
    if (search) {
      // Get product IDs that match search criteria
      const searchPattern = `%${search}%`;

      const matchingStoreProducts = await this.database.db
        .select({ productId: storeItems.productId })
        .from(storeItems)
        .where(like(storeItems.name, searchPattern));

      const matchingProgrammeProducts = await this.database.db
        .select({ productId: programmes.productId })
        .from(programmes)
        .where(like(programmes.title, searchPattern));

      const matchingPodcastProducts = await this.database.db
        .select({ productId: podcasts.productId })
        .from(podcasts)
        .where(like(podcasts.title, searchPattern));

      const allMatchingProductIds = [
        ...matchingStoreProducts.map((p) => p.productId),
        ...matchingProgrammeProducts.map((p) => p.productId),
        ...matchingPodcastProducts.map((p) => p.productId),
      ];

      if (allMatchingProductIds.length > 0) {
        bookmarkQuery = bookmarkQuery.where(
          and(
            eq(bookmarks.userId, userId),
            or(
              ...allMatchingProductIds.map((id) => eq(bookmarks.productId, id)),
            ),
          ),
        );
      } else {
        // No matching products found, return empty result
        return { bookmarks: [], total: 0 };
      }
    }

    // Execute query with pagination
    const [bookmarkResults, totalResults] = await Promise.all([
      bookmarkQuery.orderBy(desc(bookmarks.id)).offset(skip).limit(pageSize),
      this.database.db
        .select({ count: count() })
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId)),
    ]);

    // Enrich bookmarks with relations
    const enrichedBookmarks: BookmarkWithRelations[] = [];
    for (const bookmark of bookmarkResults) {
      const enriched = await this.getBookmarkWithRelations(bookmark.id);
      enrichedBookmarks.push(enriched);
    }

    return { bookmarks: enrichedBookmarks, total: totalResults[0].count };
  }

  // Find bookmark by ID
  async findOne(id: string): Promise<BookmarkWithRelations | null> {
    const bookmark = (
      await this.database.db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.id, id))
    )[0];

    if (!bookmark) {
      return null;
    }

    return this.getBookmarkWithRelations(bookmark.id);
  }

  // Remove bookmark
  async remove(userId: string, productId: string): Promise<Bookmark> {
    // Check if bookmark exists
    const bookmark = (
      await this.database.db
        .select()
        .from(bookmarks)
        .where(
          and(eq(bookmarks.productId, productId), eq(bookmarks.userId, userId)),
        )
    )[0];

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    // Delete bookmark
    const deletedBookmark = (
      await this.database.db
        .delete(bookmarks)
        .where(
          and(eq(bookmarks.productId, productId), eq(bookmarks.userId, userId)),
        )
        .returning()
    )[0];

    return deletedBookmark;
  }

  // Remove bookmark by ID
  async removeById(id: string): Promise<Bookmark> {
    // Check if bookmark exists
    const bookmark = (
      await this.database.db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.id, id))
    )[0];

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    // Delete bookmark
    const deletedBookmark = (
      await this.database.db
        .delete(bookmarks)
        .where(eq(bookmarks.id, id))
        .returning()
    )[0];

    return deletedBookmark;
  }

  // Private helper method to get bookmark with relations
  private async getBookmarkWithRelations(
    bookmarkId: string,
  ): Promise<BookmarkWithRelations> {
    const bookmark = (
      await this.database.db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId))
    )[0];

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, bookmark.productId))
    )[0];

    const storeItem =
      (
        await this.database.db
          .select()
          .from(storeItems)
          .where(eq(storeItems.productId, bookmark.productId))
      )[0] || null;

    const programme =
      (
        await this.database.db
          .select()
          .from(programmes)
          .where(eq(programmes.productId, bookmark.productId))
      )[0] || null;

    const podcast =
      (
        await this.database.db
          .select()
          .from(podcasts)
          .where(eq(podcasts.productId, bookmark.productId))
      )[0] || null;

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
        .where(eq(users.id, bookmark.userId))
    )[0];

    return {
      ...bookmark,
      product: {
        ...product,
        storeItem,
        programme,
        podcast,
      },
      user,
    } as BookmarkWithRelations;
  }
}
