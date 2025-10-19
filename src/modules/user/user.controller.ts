import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles, StrictRoles } from 'src/common/decorators/roles.decorator';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import { ResponseDto } from 'src/util/dto/response.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { CUSTOM_HEADERS } from 'src/config/constants.config';
import { StorageService } from 'src/util/storage/storage.service';
import { DocumentType } from 'src/util/storage/constants';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MulterFile } from 'src/types';

@Controller('user')
@UseGuards(RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  // Get current user profile
  @Get('me')
  async getProfile(@Req() req: Request) {
    return ResponseDto.createSuccessResponse('Profile retrieved successfully', {
      user: req.user,
    });
  }

  // Update current user profile
  @Put('me')
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    console.log(updateProfileDto, req.user);
    const updatedUser = await this.userService.updateProfile(
      (req.user as User).id,
      updateProfileDto,
    );
    return ResponseDto.createSuccessResponse('Profile updated successfully', {
      user: updatedUser,
    });
  }

  // Update user profile picture
  @Post('me/profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  async updateProfilePicture(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type (images only)
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // Upload file to storage
    const uploadResult = await this.storageService.uploadFileWithMetadata(
      file,
      {
        documentType: DocumentType.PROFILE_PICTURE,
        fileName: `${(req.user as User).id}_profile_${Date.now()}`,
      },
    );

    // Update user's profile picture URL
    const updatedUser = await this.userService.updateProfile(
      (req.user as User).id,
      {
        profilePicture: uploadResult.url,
      },
    );

    return ResponseDto.createSuccessResponse(
      'Profile picture updated successfully',
      {
        user: updatedUser,
        upload: {
          url: uploadResult.url,
          fileKey: uploadResult.fileKey,
          size: uploadResult.size,
        },
      },
    );
  }

  // Admin/Moderator: Get all users with pagination and filters (Strict mode for clear suspension messaging)
  @StrictRoles(UserRole.ADMIN, UserRole.MODERATOR)
  @Get()
  async getAllUsers(@Query() query: UserQueryDto) {
    const { users, total } = await this.userService.findManyWithFilters(query);
    const { page = 1, pageSize = 10 } = query;

    return ResponseDto.createPaginatedResponse(
      'Users retrieved successfully',
      users,
      {
        total,
        page,
        pageSize,
      },
    );
  }

  // Admin/Moderator: Get simple stats for dashboard (only totals)
  @StrictRoles(UserRole.ADMIN, UserRole.MODERATOR)
  @Get('stats')
  async getUserStats() {
    const stats = await this.userService.getStats();
    return ResponseDto.createSuccessResponse('User stats retrieved', stats);
  }

  // Admin/Moderator: Get user by ID (Strict mode for clear suspension messaging)
  @StrictRoles(UserRole.ADMIN, UserRole.MODERATOR)
  @Get(':id')
  async findUserById(@Param('id') id: string) {
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return ResponseDto.createSuccessResponse('User retrieved successfully', {
      user,
    });
  }

  // Admin: Toggle user active/inactive status (Strict mode for clear suspension messaging)
  @StrictRoles(UserRole.ADMIN)
  @Put(':id/status')
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() toggleUserStatusDto: ToggleUserStatusDto,
    @Req() req: Request,
  ) {
    if ((req.user as User).id === id) {
      throw new BadRequestException('You cannot toggle your own status');
    }
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userService.toggleUserStatus(
      id,
      toggleUserStatusDto.isActive,
    );

    const action = toggleUserStatusDto.isActive ? 'activated' : 'deactivated';
    return ResponseDto.createSuccessResponse(`User ${action} successfully`, {
      user: updatedUser,
    });
  }

  // Admin only: Change user role - MODERATOR cannot access this
  @StrictRoles(UserRole.ADMIN)
  @Put('role/:id')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleDto,
    @Req() req: Request,
  ) {
    // Prevent self role change
    if ((req.user as User).id === id) {
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.userService.changeUserRole(id, body.role);
    return ResponseDto.createSuccessResponse('User role updated successfully', {
      user,
    });
  }

  // Test delete account for development environment only
  @Delete('test/delete')
  async testDeleteAccount(@CurrentUser() user: User) {
    const nodeEnv = this.configService.get(ENV.NODE_ENV);
    if (nodeEnv !== 'development') {
      throw new UnauthorizedException(
        'This endpoint is only available in development',
      );
    }
    const deletedUser = await this.userService.remove(user.id);

    return ResponseDto.createSuccessResponse(
      'Test delete account: user deleted',
      {
        user: deletedUser,
      },
    );
  }
}
