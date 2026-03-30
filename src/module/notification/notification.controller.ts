import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Request } from 'express';

@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(@Req() req: Request) {
    const userId = req.user!.id;
    const role = req.user!.role;
    return this.notificationService.getNotificationsForUser(userId, role);
  }

  @Patch('read-all')
  async markAllRead(@Req() req: Request) {
    return this.notificationService.markAllAsRead(req.user!.id, req.user!.role);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.notificationService.markAsRead(
      id,
      req.user!.id,
      req.user!.role,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const userId = req.user!.id;
    const role = req.user!.role;
    return this.notificationService.getUnreadCount(userId, role);
  }

  @Get('unread')
  async getAllUnread(@Req() req: Request) {
    const userId = req.user!.id;
    const role = req.user!.role;
    return this.notificationService.getUnreadNotifications(userId, role);
  }

  @Get('read')
  async getAllRead(@Req() req: Request) {
    const userId = req.user!.id;
    const role = req.user!.role;
    return this.notificationService.getReadNotifications(userId, role);
  }
}
