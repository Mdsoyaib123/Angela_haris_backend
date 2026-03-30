import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Public } from 'src/common/decorators/public.decorators';
import sendResponse from 'src/utils/sendResponse';
import { S3Service } from '../s3/s3.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { userRole } from '@prisma';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @Roles(userRole.ADMIN)
  @ApiOperation({ summary: 'Create organization' })
  @ApiBody({ type: CreateOrganizationDto })
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.createOrganization(dto);
  }

  @Get('all')
  @Roles(userRole.ADMIN)
  @ApiOperation({ summary: 'Get all organizations' })
  async getAll(@Res() res: Response) {
    const organizations = await this.organizationService.getOrganizations();

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Organizations retrieved successfully',
      data: organizations,
    });
  }

  @Get('details/:id')
  @Roles(userRole.ADMIN)
  @ApiOperation({ summary: 'Get organization by ID' })
  async getById(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const organization = await this.organizationService.getOrganizationById(id);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Organization retrieved successfully',
      data: organization,
    });
  }

  @Public()
  @Patch('track/:code')
  @ApiOperation({
    summary:
      'Track organization access (increment total clicks and update last accessed)',
  })
  async trackAccess(@Param('code') code: string, @Res() res: Response) {
    const organization =
      await this.organizationService.trackOrganizationAccess(code);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Organization access tracked successfully',
      data: organization,
    });
  }

  @Patch('update/:id')
  @Roles(userRole.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiOperation({
    summary: 'Update organization safe fields and optional image',
  })
  async updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const imageUrl = file
      ? await this.s3Service.uploadFile(file, 'organization-images')
      : undefined;
    const organization = await this.organizationService.updateOrganization(
      id,
      dto,
      imageUrl,
    );

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Organization updated successfully',
      data: organization,
    });
  }

  @Delete('delete/:id')
  @Roles(userRole.ADMIN)
  @ApiOperation({ summary: 'Delete organization by ID' })
  async deleteOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const organization = await this.organizationService.deleteOrganization(id);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Organization deleted successfully',
      data: organization,
    });
  }
}
