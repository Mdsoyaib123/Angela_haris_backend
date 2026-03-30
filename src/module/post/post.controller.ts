import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { PostService } from './post.service';
import { PostExistsPipe } from './pipes/post-exists.pipe';
import { UserExistsPipe } from './pipes/user-exist.pipe';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from '../s3/s3.service';
import { Request } from 'express';
import { Subscription } from 'src/common/decorators/subscription.decorator';
import { subscribeStatus } from '@prisma';

class CreatePostWithFilesDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Array of image files to upload',
  })
  images: any[];

  @ApiProperty({ description: 'A short description or caption' })
  caption?: string;
}

@Controller('post')
@UseGuards(JwtGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly s3Service: S3Service,
  ) { }

  // Feed
  @Get('feed')
  @UseGuards(JwtGuard)
  async getSmartFeed(@Req() req: Request) {
    const userId = req.user!.id;
    return await this.postService.getSmartFeedTwo(userId);
  }

  // Seen Posts
  @Post(':id/seen')
  async markAsSeen(
    @Param('id', ParseUUIDPipe) postId: string,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;
    return await this.postService.markAsSeenTwo(postId, userId);
  }

  @Get()
  async findAllPost() {
    return this.postService.findAll();
  }

  @Get('user')
  @UseGuards(JwtGuard)
  async findCurrentUserAllPost(@Req() req: Request) {
    const { id } = req.user!;
    return this.postService.findCurrentUserAllPost(id);
  }

  @Get('user/:userId')
  async findPostsByUser(
    @Param('userId', ParseUUIDPipe, UserExistsPipe) userId: string,
  ) {
    return this.postService.findAllByUserId(userId);
  }

  @Post('create')
@UseInterceptors(FilesInterceptor('images', 10))
@ApiConsumes('multipart/form-data')
@ApiBody({ type: CreatePostWithFilesDto })
async createPost(
  @UploadedFiles() files: Array<Express.Multer.File>,
  @Body() body: any,  // <-- use any
  @Req() req: Request,
) {
  console.log('BODY:', body);
  console.log('CAPTION:', body.caption);

  if (!files || files.length === 0) {
    throw new BadRequestException('At least one image is required');
  }

  const uploadPromises = files.map((file) =>
    this.s3Service.uploadFile(file, 'posts/images'),
  );
  const urls = await Promise.all(uploadPromises);

  return await this.postService.create(
    { urls, caption: body.caption },
    req.user!.id,
  );
}

  @Get(':id')
  async finSinglePost(@Param('id', ParseUUIDPipe, PostExistsPipe) id: string) {
    return this.postService.findOne(id);
  }

  @Patch('update/:id')
  @UseInterceptors(FilesInterceptor('images', 10))
  async updatePost(
    @Param('id', ParseUUIDPipe, PostExistsPipe) postId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { caption?: string; keptImageUrls?: string | string[] },
    @Req() req: Request,
  ) {
    const keptImageUrls =
      typeof body.keptImageUrls === 'string'
        ? [body.keptImageUrls]
        : body.keptImageUrls;

    let newUrls: string[] = [];
    if (files && files.length > 0) {
      const uploadPromises = files.map((file) =>
        this.s3Service.uploadFile(file, 'posts/images'),
      );
      newUrls = await Promise.all(uploadPromises);
    }

    return await this.postService.update(postId, req.user!.id, {
      caption: body.caption,
      keptImageUrls,
      newUrls,
    });
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Param('id', ParseUUIDPipe, PostExistsPipe) id: string,
    @Req() req: Request,
  ) {
    return await this.postService.remove(id, req.user!);
  }
}
