import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { BookmarkQueryDto } from './dto/bookmark-query.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
import { User } from '@prisma/client';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('bookmark')
@Auth()
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  // Create a new bookmark
  @Post()
  async create(
    @Body() createBookmarkDto: CreateBookmarkDto,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    const bookmark = await this.bookmarkService.create(
      user.id,
      createBookmarkDto,
    );

    return ResponseDto.createSuccessResponse(
      'Bookmark created successfully',
      bookmark,
    );
  }

  // Get all bookmarks for the current user
  @Get()
  async findAll(@Query() query: BookmarkQueryDto, @Req() req: Request) {
    const user = req.user as User;
    const { bookmarks, total } = await this.bookmarkService.findAll(
      user.id,
      query,
    );

    const { page = 1, pageSize = 10 } = query;

    return ResponseDto.createPaginatedResponse(
      'Bookmarks retrieved successfully',
      bookmarks,
      {
        total,
        page,
        pageSize,
      },
    );
  }

  // Get bookmark by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const bookmark = await this.bookmarkService.findOne(id);
    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    return ResponseDto.createSuccessResponse(
      'Bookmark retrieved successfully',
      bookmark,
    );
  }

  // Remove bookmark by product ID
  @Delete('product/:productId')
  async removeByProduct(
    @Param('productId') productId: string,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    const deletedBookmark = await this.bookmarkService.remove(
      user.id,
      productId,
    );

    return ResponseDto.createSuccessResponse(
      'Bookmark removed successfully',
      deletedBookmark,
    );
  }

  // Remove bookmark by bookmark ID
  @Delete(':id')
  async removeById(@Param('id') id: string) {
    const deletedBookmark = await this.bookmarkService.removeById(id);

    return ResponseDto.createSuccessResponse(
      'Bookmark removed successfully',
      deletedBookmark,
    );
  }
}
