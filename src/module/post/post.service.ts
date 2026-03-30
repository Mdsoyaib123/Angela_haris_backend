import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Post } from '@prisma';
import { CreatePostDto } from './dto/create-post.dto';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);
  constructor(
    private prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  // get Smart Feed
  async getSmartFeed(userId: string) {
    const posts = await this.prisma.client.post.findMany({
      where: {
        NOT: {
          views: { some: { userId: userId } },
        },
      },
      include: {
        images: true,
        user: {
          select: { athleteFullName: true, imgUrl: true },
        },
        _count: {
          select: {
            commentsList: true,
            likesList: true,
            views: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (posts.length === 0) {
      return await this.prisma.client.post.findMany({
        include: {
          images: true,
          user: { select: { athleteFullName: true, imgUrl: true } },
          _count: {
            select: {
              commentsList: true,
              likesList: true,
              views: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    return posts;
  }

  // get Smart Feed Two
  async getSmartFeedTwo(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    let posts = await this.prisma.client.post.findMany({
      where: {
        NOT: {
          views: { some: { userId: userId } },
        },
      },
      include: {
        images: true,
        user: { select: { athleteFullName: true, imgUrl: true } },
        // _count: {
        //   select: {
        //     commentsList: true,
        //     likesList: true,
        //   },
        // },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: skip,
    });

    if (posts.length < limit) {
      const seenPosts = await this.prisma.client.post.findMany({
        where: {
          views: { some: { userId: userId } },
        },
        include: {
          images: true,
          user: { select: { athleteFullName: true, imgUrl: true } },
          // _count: {
          //   select: {
          //     commentsList: true,
          //     likesList: true,
          //   },
          // },
        },
        orderBy: { createdAt: 'desc' },
        take: limit - posts.length,
        skip: skip,
      });
      posts = [...posts, ...seenPosts];
    }

    return posts;
  }

  async markAsSeen(postId: string, userId: string) {
    await this.prisma.client.$transaction(async (tx) => {
      const existingView = await tx.postView.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });

      if (!existingView) {
        await tx.postView.create({
          data: { userId, postId },
        });

        await tx.post.update({
          where: { id: postId },
          data: { viewCount: { increment: 1 } },
        });
      }
    });

    return { success: true };
  }

  async markAsSeenTwo(postId: string, userId: string) {
    return await this.prisma.client.$transaction(async (tx) => {
      const existingView = await tx.postView.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });

      if (!existingView) {
        await tx.postView.create({
          data: { userId, postId },
        });

        await tx.post.update({
          where: { id: postId },
          data: { viewCount: { increment: 1 } },
        });

        return { message: 'First time seen, count incremented', status: 'new' };
      }

      return { message: 'Already seen', status: 'existing' };
    });
  }

  // Create Post

  async create(createPostDto: CreatePostDto, userId: string): Promise<any> {
    try {
      const { urls, caption } = createPostDto;

      console.log('caption',caption)

      const createdPost = await this.prisma.client.post.create({
        data: {
          caption,
          user: {
            connect: { id: userId },
          },
          images: {
            create: urls.map((url) => ({
              url: url,
            })),
          },
        },
        include: {
          images: true,
          user: {
            select: {
              id: true,
              athleteFullName: true,
              email: true,
            },
          },
        },
      });

      console.log('crete post ', createdPost)

      return createdPost;
    } catch (error) {
      console.error('Post creation error:', error);
      throw new InternalServerErrorException(
        'Could not create post. Make sure the User ID is valid and data is correct.',
      );
    }
  }

  // FindOne By Id
  async findOne(id: string): Promise<Post> {
    const singlePost = await this.prisma.client.post.findUnique({
      where: { id },
      include: {
        images: true,
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

    if (!singlePost) {
      throw new NotFoundException(`Post with ID ${id} is not found`);
    }
    return singlePost;
  }

  // Find All Post
  async findAll(): Promise<Post[]> {
    const posts = await this.prisma.client.post.findMany({
      include: {
        images: true,
        user: {
          select: {
            id: true,
            athleteFullName: true,
            email: true,
            role: true,
            imgUrl: true,
          },
        },
        commentsList: {},
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return posts;
  }

  // Find Current User Post
  async findCurrentUserAllPost(id: string): Promise<Post[]> {
    const posts = await this.prisma.client.post.findMany({
      where: {
        userId: id,
      },
      include: {
        images: true,
        user: {
          select: {
            id: true,
            athleteFullName: true,
            email: true,
          },
        },
        commentsList: {},
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return posts;
  }

  // Find All Posts by User ID
  async findAllByUserId(userId: string): Promise<Post[]> {
    const posts = await this.prisma.client.post.findMany({
      where: {
        userId: userId,
      },
      include: {
        images: true,
        user: {
          select: {
            id: true,
            athleteFullName: true,
            email: true,
          },
        },
        commentsList: {},
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return posts;
  }

  // Update Post only user
  async update(
    postId: string,
    userId: string,
    data: { caption?: string; keptImageUrls?: string[]; newUrls?: string[] },
  ) {
    try {
      const post = await this.prisma.client.post.findUnique({
        where: { id: postId },
        include: { images: true },
      });

      if (!post || post.userId !== userId) {
        throw new ForbiddenException('You cannot update this post');
      }

      const keptUrls = data.keptImageUrls || [];
      const imagesToDelete = post.images.filter(
        (img) => !keptUrls.includes(img.url),
      );

      if (imagesToDelete.length > 0) {
        this.logger.log(
          `Deleting ${imagesToDelete.length} images for post ${postId}`,
        );
        const deletePromises = imagesToDelete.map((img) =>
          this.s3Service
            .deleteFile(img.url)
            .catch((err) => this.logger.error(err)),
        );
        await Promise.all(deletePromises);

        await this.prisma.client.postImage.deleteMany({
          where: { id: { in: imagesToDelete.map((img) => img.id) } },
        });
      }

      const newImageEntries = (data.newUrls || []).map((url) => ({ url }));

      return await this.prisma.client.post.update({
        where: { id: postId },
        data: {
          caption: data.caption ?? post.caption,
          images: {
            create: newImageEntries,
          },
        },
        include: { images: true },
      });
    } catch (error: any) {
      this.logger.error('Update failed', error.stack);
      throw new InternalServerErrorException('Failed to update post');
    }
  }

  // Detele Post
  async remove(id: string, user: any) {
    try {
      const postToDelete = await this.prisma.client.post.findUnique({
        where: { id },
        include: {
          images: true,
          user: true,
        },
      });

      if (!postToDelete) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }

      const isOwner = postToDelete.userId === user.id;
      const isAdmin = user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        throw new ForbiddenException(
          'You do not have permission to delete this post',
        );
      }

      if (postToDelete.images && postToDelete.images.length > 0) {
        this.logger.log(
          `Deleting ${postToDelete.images.length} images from S3 for post ${id}`,
        );

        const deletePromises = postToDelete.images.map((img) =>
          this.s3Service.deleteFile(img.url).catch((err) => {
            this.logger.error(
              `Failed to delete file from S3: ${img.url}`,
              err.stack,
            );
          }),
        );

        await Promise.all(deletePromises);
      }

      await this.prisma.client.post.delete({
        where: { id },
      });

      return { message: 'Post and associated images deleted successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`Error deleting post ${id}:`, error.stack);
      throw new InternalServerErrorException('Could not delete the post');
    }
  }
}
