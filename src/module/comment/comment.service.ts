import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { NotificationService } from '../notification/notification.service';
import { Comment } from '@prisma';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // FindOne By Id
  async findOne(id: string): Promise<Comment> {
    const singleComment = await this.prisma.client.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            athleteFullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!singleComment) {
      throw new NotFoundException(`Comment with ID ${id} is not found`);
    }
    return singleComment;
  }

  // Get All comments By PostID --> Only 3 lair(level) comment get
  async getCommentsByPost(postId: string) {
    const post = await this.prisma.client.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return await this.prisma.client.comment.findMany({
      where: {
        postId: postId,
        parentId: null,
      },
      include: {
        user: {
          select: {
            athleteFullName: true,
            imgUrl: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                athleteFullName: true,
                imgUrl: true,
              },
            },
            replies: {
              include: {
                user: { select: { athleteFullName: true, imgUrl: true } },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Multiple lair or level comment get---
  async getCommentsTreeByPost(postId: string) {
    const allComments = await this.prisma.client.comment.findMany({
      where: { postId },
      include: {
        user: { select: { athleteFullName: true, imgUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (allComments.length === 0) return [];

    type CommentWithReplies = (typeof allComments)[0] & {
      replies: CommentWithReplies[];
    };

    const commentMap = new Map<string, CommentWithReplies>();
    const rootComments: CommentWithReplies[] = [];

    allComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    allComments.forEach((comment) => {
      const currentComment = commentMap.get(comment.id)!;

      if (comment.parentId === null) {
        rootComments.push(currentComment);
      } else {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(currentComment);
        }
      }
    });

    return rootComments;
  }

  // Create commnet
  async createComment(userId: string, dto: CreateCommentDto) {
    const { content, postId, parentId } = dto;

    const post = await this.prisma.client.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found. Cannot add comment.');
    }

    if (parentId) {
      const parentComment = await this.prisma.client.comment.findUnique({
        where: { id: parentId },
        select: { postId: true },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException(
          'Parent comment not found or does not belong to this post.',
        );
      }
    }

    const newComment = await this.prisma.client.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          content,
          userId,
          postId,
          parentId: parentId || null,
        },
        include: {
          user: { select: { id: true, athleteFullName: true } },
          post: { select: { userId: true } },
          parent: { select: { userId: true } },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { comments: { increment: 1 } },
      });

      return comment;
    });

    this.sendCommentNotifications(newComment, userId, postId, parentId).catch(
      (err) => this.logger.error('Notification error', err),
    );

    return newComment;
  }

  private async sendCommentNotifications(
    newComment: any,
    userId: string,
    postId: string,
    parentId?: string,
  ) {
    try {
      const postOwnerId = newComment.post.userId;
      const commenterName = newComment.user.athleteFullName || 'Someone';

      if (postOwnerId !== userId) {
        await this.notificationService.createAndSend({
          recipientId: postOwnerId,
          senderId: userId,
          postId: postId,
          title: parentId ? 'New Reply on Post ↩️' : 'New Comment 💬',
          message: parentId
            ? `${commenterName} replied to a comment on your post`
            : `${commenterName} commented on your post`,
          type: parentId ? 'REPLY' : 'COMMENT',
        });
      }

      if (parentId) {
        const originalCommenterId = newComment.parent?.userId;
        if (
          originalCommenterId &&
          originalCommenterId !== userId &&
          originalCommenterId !== postOwnerId
        ) {
          await this.notificationService.createAndSend({
            recipientId: originalCommenterId,
            senderId: userId,
            postId: postId,
            title: 'New Reply ↩️',
            message: `${commenterName} replied to your comment`,
            type: 'REPLY',
          });
        }
      }
    } catch (error) {
      this.logger.error('Background Notification Failed', error);
    }
  }

  // async createComment(userId: string, dto: CreateCommentDto) {
  //   const { content, postId, parentId } = dto;

  //   return await this.prisma.client.$transaction(async (tx) => {
  //     const newComment = await tx.comment.create({
  //       data: {
  //         content,
  //         userId,
  //         postId,
  //         parentId: parentId || null,
  //       },
  //       include: {
  //         user: {
  //           select: { athleteFullName: true, imgUrl: true },
  //         },
  //       },
  //     });

  //     // Count comment
  //     await tx.post.update({
  //       where: { id: postId },
  //       data: {
  //         comments: { increment: 1 },
  //       },
  //     });

  //     return newComment;
  //   });
  // }

  // Update Comment
  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    // 1. Check comment if the user available
    const comment = await this.prisma.client.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    // 2. Update comment
    return await this.prisma.client.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
      },
      include: {
        user: {
          select: { athleteFullName: true, imgUrl: true },
        },
        replies: {
          include: {
            user: { select: { athleteFullName: true, imgUrl: true } },
            replies: {
              include: {
                user: { select: { athleteFullName: true, imgUrl: true } },
              },
            },
          },
        },
      },
    });
  }

  // Remove comment & Reply comment
  async removeComment(commentId: string, currentUser: any) {
    const comment = await this.prisma.client.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: { userId: true },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check permission
    const isCommentOwner = comment.userId === currentUser.id;
    const isPostCreator = comment.post.userId === currentUser.id;

    if (!isCommentOwner && !isPostCreator) {
      throw new ForbiddenException(
        'You do not have permission to delete this comment',
      );
    }

    return await this.prisma.client.$transaction(async (tx) => {
      await tx.comment.delete({
        where: { id: commentId },
      });

      const actualCount = await tx.comment.count({
        where: { postId: comment.postId },
      });

      await tx.post.update({
        where: { id: comment.postId },
        data: { comments: actualCount },
      });

      return { message: 'Comment deleted successfully' };
    });
  }

  // Reply comment
  async createReply(userId: string, dto: ReplyCommentDto) {
    const { content, postId, parentId } = dto;

    const parentComment = await this.prisma.client.comment.findUnique({
      where: { id: parentId },
    });

    if (!parentComment || parentComment.postId !== postId) {
      throw new NotFoundException(
        'The comment you are replying to does not exist on this post',
      );
    }

    return await this.prisma.client.$transaction(async (tx) => {
      const reply = await tx.comment.create({
        data: {
          content,
          userId,
          postId,
          parentId,
        },
        include: {
          user: {
            select: { athleteFullName: true, imgUrl: true },
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: {
          comments: { increment: 1 },
        },
      });

      return reply;
    });
  }
}
