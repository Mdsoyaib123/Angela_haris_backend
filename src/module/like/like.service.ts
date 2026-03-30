import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class LikeService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async toggleLike(postId: string, userId: string) {
    const post = await this.prisma.client.post.findUnique({
      where: { id: postId },
      select: { userId: true, caption: true, likes: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.prisma.client.like.findUnique({
      where: {
        userId_postId: { userId, postId }, // Composite key used
      },
    });

    return await this.prisma.client.$transaction(async (tx) => {
      if (existingLike) {
        await tx.like.delete({
          where: { id: existingLike.id },
        });

        await tx.post.update({
          where: { id: postId },
          data: { likes: { decrement: post.likes > 0 ? 1 : 0 } },
        });

        return { liked: false, message: 'Like removed' };
      } else {
        await tx.like.create({
          data: { userId, postId },
        });

        await tx.post.update({
          where: { id: postId },
          data: { likes: { increment: 1 } },
        });

        if (post.userId !== userId) {
          const liker = await this.prisma.client.user.findUnique({
            where: { id: userId },
            select: { athleteFullName: true },
          });

          await this.notificationService.createAndSend({
            recipientId: post.userId,
            senderId: userId,
            postId: postId,
            title: 'New Like ❤️',
            message: `${liker?.athleteFullName || 'Someone'} liked your post`,
            type: 'LIKE',
          });
        }

        return { liked: true, message: 'Post liked' };
      }
    });
  }
}
