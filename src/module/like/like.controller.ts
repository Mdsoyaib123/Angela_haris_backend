import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LikeService } from './like.service';
import { Request } from 'express';
import { JwtGuard } from 'src/common/guards/jwt.guard';

@Controller('post')
@UseGuards(JwtGuard)
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post(':id/like')
  async togglePostLike(
    @Param('id', ParseUUIDPipe) id: string, // post id
    @Req() req: Request,
  ) {
    return this.likeService.toggleLike(id, req.user!.id);
  }
}
