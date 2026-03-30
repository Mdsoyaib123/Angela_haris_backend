import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';

import { CommentService } from './comment.service';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { Request } from 'express';

@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get('post/:postId') // post id
  async getComments(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.commentService.getCommentsByPost(postId);
  }

  @Get('tree/post/:postId')
  async getTreeComments(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.commentService.getCommentsTreeByPost(postId);
  }

  // Create comment
  @Post()
  async addComment(@Req() req: Request, @Body() dto: CreateCommentDto) {
    return this.commentService.createComment(req.user!.id, dto);
  }

  // Update comment
  @Put('update/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string, // comment id
    @Req() req: Request,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentService.updateComment(
      id,
      req.user!.id,
      updateCommentDto,
    );
  }

  // Delete comment
  @Delete('delete/:id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string, // comment id
    @Req() req: Request,
  ) {
    return this.commentService.removeComment(id, req.user!);
  }

  @Post('reply')
  async createReply(@Req() req: Request, @Body() dto: ReplyCommentDto) {
    return this.commentService.createReply(req.user!.id, dto);
  }
}
