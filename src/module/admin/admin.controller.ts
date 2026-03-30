// src/admin/admin.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  HttpStatus,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { GetUsersQueryDto } from './dto/admin.dto';
import sendResponse from '../../utils/sendResponse';
import { Public } from 'src/common/decorators/public.decorators';
import { userRole } from '@prisma';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ManageUserQueryDto, UserAction } from './dto/action.dto';
import { CreateUserDto, UpdateUserPlanDto } from './dto/create.user.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('allUsers')
  @ApiOperation({
    summary: 'Get all users (Admin)',
    description:
      'Returns a list of users with filtering by role (USER, ATHLATE, ALL) and search by name, email, ID, or city.',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['USER', 'ATHLATE', 'all'],
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, email, ID, or city',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUsers(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: GetUsersQueryDto,
  ) {
    const result = await this.adminService.getUsers(query);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    });
  }

  @Post('manage-user/:userId')
  @ApiOperation({
    summary: 'Manage user by ID (Admin)',
    description:
      'Perform action on user: delete (soft), deactivate, or activate. Defaults to deactivate if no action specified.',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'User ID to manage',
    type: String,
  })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: ['delete', 'deactivate', 'activate'],
    description:
      'Action to perform: delete (sets isDeleted=true), deactivate (sets isActive=false), or activate (sets isActive=true). Default: deactivate',
  })
  async manageUser(
    @Req() req: Request,
    @Res() res: Response,
    @Param('userId') userId: string,
    @Query() query: ManageUserQueryDto,
  ) {
    const action = query.action || UserAction.DEACTIVATE; // default to deactivate

    await this.adminService.manageUser(userId, action);

    const message =
      action === UserAction.DELETE
        ? 'User soft-deleted successfully'
        : action === UserAction.DEACTIVATE
          ? 'User deactivated successfully'
          : 'User activated successfully';

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message,
      data: null,
    });
  }

  @Get('user-details/:userId')
  @Roles(userRole.ADMIN)
  @ApiOperation({
    summary: 'Get user details by ID (Admin)',
    description:
      'Returns complete user information including profile, stats, highlights, subscriptions, transactions, and recent activity',
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'User ID to fetch details for',
    type: String,
  })
  async getUserDetails(
    @Req() req: Request,
    @Res() res: Response,
    @Param('userId') userId: string,
  ) {
    const result = await this.adminService.getUserDetails(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User details retrieved successfully',
      data: result,
    });
  }

  // overView
  @Get('admin/dashboard-stats')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Returns total counts, month-over-month percentage changes, and current year monthly user stats',
  })
  async getDashboardStats(@Req() req: Request, @Res() res: Response) {
    const result = await this.adminService.getDashboardStats();

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: result,
    });
  }

  @Post('add-user')
  @Roles(userRole.ADMIN)
  async createUser(
    @Body() dto: CreateUserDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.adminService.createUser(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: result.message,
      data: result.data,
    });
  }

  @Post('update-user-subscription-plan')
  @Roles(userRole.ADMIN)
  async updateUserSubscriptionPlan(
    @Body() dto: UpdateUserPlanDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.adminService.updateUserSubscriptionPlan(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: result.message,
      data: result.data,
    });
  }

  @Get('/stats/subscribers')
  async getSubscriberCounts(@Res() res: Response) {
    const counts = await this.adminService.getSubscriberCounts();

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Subscriber counts retrieved',
      data: counts,
    });
  }

  // ... your existing findAllSubscriptions endpoint ...
  @Get('userDetails/:id')
  @ApiOperation({
    summary: 'Get user details by ID',
    description:
      'Returns user profile information, total highlight count, and list of referred users. Password is never exposed.',
  })
  async getUserById(
    @Param('id') userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.adminService.getUserById(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User details retrieved',
      data: result,
    });
  }
}
