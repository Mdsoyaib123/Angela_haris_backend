/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Request } from 'express';
import { ToggleLikeDto } from './dto/toggleLike.dto';
import { Public } from 'src/common/decorators/public.decorators';

@Controller('post-reel')
@UseGuards(JwtGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feeds')
  @Public()
  async getSmartFeed(
    @Req() req: Request,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.query.userId as string || req.user!.id as string;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 100) || 20;

    return await this.feedService.getSmartFeed(userId, pageNum, limitNum);
  }

  @Get('my-feeds')
  async getMyFeeds(
    @Req() req: Request,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const userId = req.user!.id;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    return await this.feedService.getMyFeeds(userId, pageNum, limitNum);
  }

  @Get('user-feeds/:id')
  @Public()
  async getSingleUserFeeds(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) userId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    return await this.feedService.getMyFeeds(userId, pageNum, limitNum);
  }

  @Post(':id/like')
  async toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() toggleLikeDto: ToggleLikeDto,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;
    return await this.feedService.toggleLike(
      id,
      userId,
      toggleLikeDto.feedType,
    );
  }

  @Post(':id/seen')
  async markAsSeen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleLikeDto,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;
    return await this.feedService.markAsSeen(id, userId, dto.feedType);
  }
}
