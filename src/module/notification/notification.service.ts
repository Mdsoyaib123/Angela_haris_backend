/* eslint-disable no-useless-catch */
import { Injectable, NotFoundException } from '@nestjs/common';
import { userRole } from '@prisma';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationGateway,
  ) {}

  async createAndSend({
    recipientId,
    senderId,
    postId,
    highlightId,
    title,
    message,
    type,
  }: {
    recipientId: string;
    senderId: string;
    postId?: string;
    highlightId?: string;
    title: string;
    message: string;
    type: 'LIKE' | 'COMMENT' | 'NEW_POST' | 'REPLY' | 'SUBSCRIPTION';
  }) {
    // Check for duplicate notifications within the last 30 seconds
    const recentNotification = await this.prisma.client.notification.findFirst({
      where: {
        userId: recipientId,
        senderId: senderId,
        postId: postId,
        highlightId: highlightId,
        type: type,
        createdAt: {
          gte: new Date(Date.now() - 30000), // 30 seconds ago
        },
      },
    });

    if (recentNotification) {
      // Return existing notification instead of creating a duplicate
      return recentNotification;
    }

    const notification = await this.prisma.client.notification.create({
      data: {
        userId: recipientId,
        senderId,
        postId,
        highlightId,
        title,
        message,
        type,
      },
      include: {
        sender: {
          select: { athleteFullName: true, imgUrl: true },
        },
      },
    });

    this.gateway.sendToUser(recipientId, notification);

    return notification;
  }

  async createLikeNotification(
    postOwnerId: string,
    likerName: string,
    postId: string,
  ) {
    const newNotification = await this.prisma.client.notification.create({
      data: {
        userId: postOwnerId,
        title: 'New Like ❤️',
        message: `${likerName} liked your post`,
        type: 'LIKE',
        postId: postId,
      },
    });

    this.gateway.sendNotification(postOwnerId, newNotification);

    return newNotification;
  }

  async getNotificationsForUser(userId: string, role?: string) {
    const include = {
      sender: {
        select: { athleteFullName: true, imgUrl: true },
      },
      post: {
        select: { images: true, caption: true },
      },
    };

    if (role === userRole.ADMIN) {
      return await this.prisma.client.notification.findMany({
        where: { user: { role: userRole.ADMIN } },
        include,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    return await this.prisma.client.notification.findMany({
      where: { userId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string, role?: string) {
    try {
      const notification = await this.prisma.client.notification.findUnique({
        where: { id: notificationId },
        include: {
          user: {
            select: { id: true, role: true },
          },
        },
      });

      if (!notification) {
        throw new NotFoundException(
          `Notification with ID ${notificationId} not found`,
        );
      }

      // Regular users can only mark their own notifications.
      // Admins can mark any notification that belongs to an ADMIN user.
      if (
        role === userRole.ADMIN &&
        notification.user?.role === userRole.ADMIN
      ) {
        return await this.prisma.client.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
      }

      if (notification.userId !== userId) {
        throw new NotFoundException(
          `Notification with ID ${notificationId} not found`,
        );
      }

      return await this.prisma.client.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    } catch (error) {
      throw error;
    }
  }

  async getUnreadCount(userId: string, role?: string) {
    if (role === userRole.ADMIN) {
      const count = await this.prisma.client.notification.count({
        where: { user: { role: userRole.ADMIN }, isRead: false },
      });
      return { unreadCount: count };
    }

    const count = await this.prisma.client.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  async getReadNotifications(userId: string, role?: string) {
    const where =
      role === userRole.ADMIN
        ? { user: { role: userRole.ADMIN }, isRead: true }
        : { userId, isRead: true };

    return await this.prisma.client.notification.findMany({
      where,
      include: {
        sender: {
          select: { athleteFullName: true, imgUrl: true },
        },
        post: {
          select: { images: true, caption: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getUnreadNotifications(userId: string, role?: string) {
    const where =
      role === userRole.ADMIN
        ? { user: { role: userRole.ADMIN }, isRead: false }
        : { userId, isRead: false };

    return await this.prisma.client.notification.findMany({
      where,
      include: {
        sender: {
          select: { athleteFullName: true, imgUrl: true },
        },
        post: {
          select: { images: true, caption: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAllAsRead(userId: string, role?: string) {
    if (role === userRole.ADMIN) {
      return await this.prisma.client.notification.updateMany({
        where: { user: { role: userRole.ADMIN }, isRead: false },
        data: { isRead: true },
      });
    }

    return await this.prisma.client.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async notifyAdminsSubscriptionSuccess(params: {
    subscriberId: string;
    subscriberName: string;
    planName: string;
  }) {
    const { subscriberId, subscriberName, planName } = params;

    const admins = await this.prisma.client.user.findMany({
      where: { role: 'ADMIN', isDeleted: false, isActive: true },
      select: { id: true },
    });

    if (!admins.length) return [];

    // Check for recent subscription notifications for the same subscriber and plan
    const recentNotifications = await this.prisma.client.notification.findMany({
      where: {
        senderId: subscriberId,
        type: 'SUBSCRIPTION',
        message: {
          contains: `subscribed to ${planName} plan`,
        },
        createdAt: {
          gte: new Date(Date.now() - 30000), // 30 seconds ago
        },
      },
      select: { userId: true },
    });

    const notifiedAdminIds = recentNotifications.map((n) => n.userId);
    const adminsToNotify = admins.filter(
      (admin) => !notifiedAdminIds.includes(admin.id),
    );

    if (!adminsToNotify.length) return [];

    const notifications = await Promise.all(
      adminsToNotify.map((admin) =>
        this.prisma.client.notification.create({
          data: {
            userId: admin.id,
            senderId: subscriberId,
            title: 'New Subscription',
            message: `${subscriberName} subscribed to ${planName} plan`,
            type: 'SUBSCRIPTION',
          },
          include: {
            sender: {
              select: { athleteFullName: true, imgUrl: true },
            },
          },
        }),
      ),
    );

    notifications.forEach((notification, index) => {
      this.gateway.sendToUser(adminsToNotify[index].id, notification);
    });

    return notifications;
  }
}
