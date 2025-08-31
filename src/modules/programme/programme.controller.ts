import { 
  Controller, 
  Post, 
  Body, 
  Patch, 
  Get, 
  Param, 
  UseGuards,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgrammeService } from './programme.service';
import { CreateProgrammeDto, UpdateProgrammeMetadataDto } from './dto/create-programme.dto';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('programme')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProgrammeController {
  constructor(private readonly programmeService: ProgrammeService) {}

  /**
   * Creates a programme and generates Mux upload URL
   */
  @Post('create-upload-url')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.CREATED)
  async createProgrammeUploadUrl(@Body() createProgrammeDto: CreateProgrammeDto) {
    return this.programmeService.createProgrammeUploadUrl(createProgrammeDto);
  }

  /**
   * Updates programme metadata after video upload
   */
  @Patch('metadata')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async updateProgrammeMetadata(@Body() updateDto: UpdateProgrammeMetadataDto) {
    return this.programmeService.updateProgrammeMetadata(updateDto);
  }

  /**
   * Gets a specific programme by product ID
   */
  @Get(':productId')
  async getProgrammeByProductId(@Param('productId') productId: string) {
    return this.programmeService.getProgrammeByProductId(productId);
  }

  /**
   * Gets all published programmes
   */
  @Get()
  async getAllPublishedProgrammes() {
    return this.programmeService.getAllPublishedProgrammes();
  }
}
