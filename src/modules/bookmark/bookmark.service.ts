import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { BookmarkQueryDto } from './dto/bookmark-query.dto';
import { BookmarkWithRelations } from './dto/bookmark-response.dto';
import { Bookmark } from '@prisma/client';

@Injectable()
export class BookmarkService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new bookmark
  async create(
    userId: string,
    createBookmarkDto: CreateBookmarkDto,
  ): Promise<BookmarkWithRelations> {
    const { productId } = createBookmarkDto;

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if bookmark already exists
    const existingBookmark = await this.prisma.bookmark.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (existingBookmark) {
      throw new ConflictException('Product is already bookmarked');
    }

    // Create bookmark
    const bookmark = await this.prisma.bookmark.create({
      data: {
        productId,
        userId,
      },
      include: {
        product: {
          include: {
            storeItem: true,
            programme: true,
            podcast: true,
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

    return bookmark as BookmarkWithRelations;
  }

  // Find all bookmarks for a user with pagination and filters
  async findAll(
    userId: string,
    query: BookmarkQueryDto,
  ): Promise<{ bookmarks: BookmarkWithRelations[]; total: number }> {
    const { page = 1, pageSize = 10, search } = query;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {
      userId,
    };

    // If search is provided, filter by product name or description
    if (search) {
      where.product = {
        OR: [
          {
            storeItem: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            programme: {
              title: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            podcast: {
              title: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
      };
    }

    // Get bookmarks with relations
    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          product: {
            include: {
              storeItem: true,
              programme: true,
              podcast: true,
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
        orderBy: {
          id: 'desc', // Most recent first
        },
      }),
      this.prisma.bookmark.count({ where }),
    ]);

    return { bookmarks: bookmarks as BookmarkWithRelations[], total };
  }

  // Find bookmark by ID
  async findOne(id: string): Promise<BookmarkWithRelations | null> {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            storeItem: true,
            programme: true,
            podcast: true,
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

    return bookmark as BookmarkWithRelations | null;
  }

  // Remove bookmark
  async remove(userId: string, productId: string): Promise<Bookmark> {
    // Check if bookmark exists
    const bookmark = await this.prisma.bookmark.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    // Delete bookmark
    const deletedBookmark = await this.prisma.bookmark.delete({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    return deletedBookmark;
  }

  // Remove bookmark by ID
  async removeById(id: string): Promise<Bookmark> {
    // Check if bookmark exists
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { id },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    // Delete bookmark
    const deletedBookmark = await this.prisma.bookmark.delete({
      where: { id },
    });

    return deletedBookmark;
  }
}
