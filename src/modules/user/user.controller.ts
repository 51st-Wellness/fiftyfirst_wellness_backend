import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles, StrictRoles } from 'src/common/decorators/roles.decorator';
import { User, UserRole } from '@prisma/client';
import { ResponseDto } from 'src/util/dto/response.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { CUSTOM_HEADERS } from 'src/config/constants.config';
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  // Get current user profile
  @UseGuards(RolesGuard)
  @Get('me')
  async getProfile(@Req() req: Request) {
    return ResponseDto.createSuccessResponse('Profile retrieved successfully', {
      user: req.user,
    });
  }

  // Update current user profile
  @UseGuards(RolesGuard)
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

  // Admin: Get all users with pagination and filters (Strict mode for clear suspension messaging)
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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

  // Admin: Get user by ID (Strict mode for clear suspension messaging)
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
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

  // Admin: Change user role (requires ROOT-API-KEY header)
  @UseGuards(RolesGuard)
  @Put('role/:id')
  async changeUserRole(
    @Param('id') id: string,
    @Body() body: ChangeRoleDto,
    @Req() req: Request,
  ) {
    const rootApiKeyHeader = req.headers[CUSTOM_HEADERS.rootApiKey] as string;
    const expectedKey = this.configService.get(ENV.ROOT_API_KEY) as string;
    if (!rootApiKeyHeader || rootApiKeyHeader !== expectedKey) {
      throw new UnauthorizedException('Invalid root api key');
    }

    const user = await this.userService.changeUserRole(id, body.role);
    return ResponseDto.createSuccessResponse('User role updated successfully', {
      user,
    });
  }
}
