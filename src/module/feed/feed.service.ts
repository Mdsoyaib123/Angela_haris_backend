import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { FeedType } from './dto/toggleLike.dto';

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async getSmartFeed(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const dbTake = skip + limit;

    const [posts, highlightsList] = await Promise.all([
      this.prisma.client.post.findMany({
        include: {
          images: {
            select: {
              id: true,
              url: true,
            },
          },
          user: {
            select: {
              id: true,
              athleteFullName: true,
              imgUrl: true,
              isActive: true,
              subscribeStatus: true,
            },
          },
          likesList: { where: { userId }, select: { id: true } },
          views: { where: { userId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: dbTake,
      }),
      this.prisma.client.highlights.findMany({
        where: { isProcessing: false },

        select: {
          id: true,
          mergedVideoUrl: true,
          caption: true,
          description: true,
          userId: true,
          isProcessing: true,
          likes: true,
          views: true,
          createdAt: true,
          highLightsLink: true,
          user: {
            select: {
              id: true,
              athleteFullName: true,
              imgUrl: true,
              isActive: true,
              subscribeStatus: true,
            },
          },
          likedBy: {
            where: { userId },
            select: { id: true },
          },
          highlightsViews: { where: { userId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: dbTake,
      }),
    ]);

    const combinedFeed = [
      ...posts.map(({ likesList, views, ...p }) => ({
        ...p,
        feedType: 'POST',
        totalLikes: p.likes || 0,
        totalViews: p.viewCount || 0,
        isSeen: views.length > 0,
        isLiked: likesList.length > 0,
      })),
      ...highlightsList.map(({ likedBy, highlightsViews, ...h }) => ({
        ...h,
        feedType: 'HIGHLIGHT',
        totalLikes: h.likes || 0,
        totalViews: h.views || 0,
        isSeen: highlightsViews.length > 0,
        isLiked: likedBy.length > 0,
      })),
    ];

    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    const sortedFeed = combinedFeed.sort((a, b) => {
      if (a.isSeen !== b.isSeen) return a.isSeen ? 1 : -1;

      const isANew = now - a.createdAt.getTime() < oneDayInMs;
      const isBNew = now - b.createdAt.getTime() < oneDayInMs;

      if (isANew && !isBNew) return -1;
      if (!isANew && isBNew) return 1;

      const scoreA = a.totalLikes + a.totalViews;
      const scoreB = b.totalLikes + b.totalViews;
      if (scoreB !== scoreA) return scoreB - scoreA;

      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return sortedFeed.slice(skip, skip + limit);
  }

  // ---  like OR unlike -----
  async toggleLike(id: string, userId: string, feedType: FeedType) {
    const target =
      feedType === FeedType.POST
        ? await this.prisma.client.post.findUnique({
            where: { id },
            select: { userId: true, likes: true },
          })
        : await this.prisma.client.highlights.findUnique({
            where: { id },
            select: { userId: true, likes: true },
          });

    if (!target) {
      throw new NotFoundException(`${feedType} not found`);
    }

    return await this.prisma.client.$transaction(async (tx) => {
      const existingLike =
        feedType === FeedType.POST
          ? await tx.like.findUnique({
              where: { userId_postId: { userId, postId: id } },
            })
          : await tx.likeHighlights.findUnique({
              where: { userId_highlightId: { userId, highlightId: id } },
            });

      if (existingLike) {
        // --- UNLIKE LOGIC ---
        if (feedType === FeedType.POST) {
          await tx.like.delete({ where: { id: existingLike.id } });
          await tx.post.update({
            where: { id },
            data: { likes: { decrement: target.likes > 0 ? 1 : 0 } },
          });
        } else {
          await tx.likeHighlights.delete({ where: { id: existingLike.id } });
          await tx.highlights.update({
            where: { id },
            data: { likes: { decrement: target.likes > 0 ? 1 : 0 } },
          });
        }
        return { liked: false, message: 'Like removed' };
      } else {
        // --- LIKE LOGIC ---
        if (feedType === FeedType.POST) {
          await tx.like.create({ data: { userId, postId: id } });
          await tx.post.update({
            where: { id },
            data: { likes: { increment: 1 } },
          });
        } else {
          await tx.likeHighlights.create({ data: { userId, highlightId: id } });
          await tx.highlights.update({
            where: { id },
            data: { likes: { increment: 1 } },
          });
        }

        if (target.userId !== userId) {
          const liker = await tx.user.findUnique({
            where: { id: userId },
            select: { athleteFullName: true },
          });

          await this.notificationService.createAndSend({
            recipientId: target.userId,
            senderId: userId,
            postId: feedType === FeedType.POST ? id : undefined,
            highlightId: feedType === FeedType.HIGHLIGHT ? id : undefined,
            title: 'New Like ❤️',
            message: `${liker?.athleteFullName || 'Someone'} liked your ${feedType.toLowerCase()}`,
            type: 'LIKE',
          });
        }

        return { liked: true, message: `${feedType} liked` };
      }
    });
  }

  async markAsSeen(id: string, userId: string, feedType: FeedType) {
    if (feedType === FeedType.POST) {
      const post = await this.prisma.client.post.findUnique({ where: { id } });
      if (!post) throw new BadRequestException('Invalid Post ID');
    } else {
      const highlight = await this.prisma.client.highlights.findUnique({
        where: { id },
      });
      if (!highlight) throw new BadRequestException('Invalid Highlight ID');
    }

    return await this.prisma.client.$transaction(async (tx) => {
      if (feedType === FeedType.POST) {
        // ১. পোস্ট ভিউ লজিক
        const existingView = await tx.postView.findUnique({
          where: { userId_postId: { userId, postId: id } },
        });

        if (!existingView) {
          await tx.postView.create({ data: { userId, postId: id } });
          await tx.post.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
          });
          return { success: true, message: 'Post view incremented' };
        }
      } else {
        const existingView = await tx.highlightsView.findUnique({
          where: { userId_highlightsId: { userId, highlightsId: id } },
        });

        if (!existingView) {
          await tx.highlightsView.create({
            data: { userId, highlightsId: id },
          });
          await tx.highlights.update({
            where: { id },
            data: { views: { increment: 1 } },
          });
          return { success: true, message: 'Highlight view incremented' };
        }
      }

      return { success: false, message: 'Already seen' };
    });
  }

  // Single User all feeds
  async getMyFeeds(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [posts, highlights] = await Promise.all([
      this.prisma.client.post.findMany({
        where: { userId },
        select: {
          id: true,
          images: {
            select: {
              id: true,
              url: true,
            },
          },
          viewCount: true,
          likes: true,
          caption : true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: skip + limit,
      }),
      this.prisma.client.highlights.findMany({
        where: { userId, isProcessing: false },
        select: {
          id: true,
          mergedVideoUrl: true,
          caption: true,
          description: true,
          views: true,
          likes: true,
          createdAt: true,
          highLightsLink: true,
        },
        orderBy: { createdAt: 'desc' },
        take: skip + limit,
      }),
    ]);

    const combinedFeed = [
      ...posts.map((p) => ({
        ...p,
        feedType: 'POST',
        totalLikes: p.likes || 0,
        totalViews: p.viewCount || 0,
      })),
      ...highlights.map(({ views, likes, ...h }) => ({
        ...h,
        feedType: 'HIGHLIGHT',
        totalLikes: likes || 0,
        totalViews: views || 0,
      })),
    ];

    const sortedFeed = combinedFeed.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return sortedFeed.slice(skip, skip + limit);
  }
}
