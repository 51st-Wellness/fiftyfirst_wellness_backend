import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreItem, Prisma } from '@prisma/client';

@Injectable()
export class StoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new store item with corresponding product
  async create(data: Prisma.StoreItemCreateInput): Promise<StoreItem> {
    return this.prisma.storeItem.create({
      data,
      include: {
        product: true,
      },
    });
  }

  // Find store item by ID
  async findById(id: string): Promise<StoreItem | null> {
    return this.prisma.storeItem.findUnique({
      where: { productId: id },
      include: {
        product: true,
      },
    });
  }

  // Find all store items with pagination and filters
  async findAll(
    skip?: number,
    take?: number,
    where?: Prisma.StoreItemWhereInput,
  ): Promise<StoreItem[]> {
    return this.prisma.storeItem.findMany({
      where,
      skip,
      take,
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Count store items with filters
  async count(where?: Prisma.StoreItemWhereInput): Promise<number> {
    return this.prisma.storeItem.count({ where });
  }

  // Update store item by ID
  async update(
    id: string,
    data: Prisma.StoreItemUpdateInput,
  ): Promise<StoreItem> {
    return this.prisma.storeItem.update({
      where: { productId: id },
      data,
      include: {
        product: true,
      },
    });
  }

  // Delete store item by ID (this will also delete the corresponding product)
  async delete(id: string): Promise<StoreItem> {
    return this.prisma.storeItem.delete({
      where: { productId: id },
      include: {
        product: true,
      },
    });
  }

  // Find featured store items
  async findFeatured(): Promise<StoreItem[]> {
    return this.prisma.storeItem.findMany({
      where: { isFeatured: true, isPublished: true },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Search store items by name or description
  async search(query: string): Promise<StoreItem[]> {
    return this.prisma.storeItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
        isPublished: true,
      },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
