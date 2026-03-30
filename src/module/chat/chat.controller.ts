import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  InternalServerErrorException,
  ParseUUIDPipe,
  Req,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { JwtGuard } from 'src/common/guards/jwt.guard';
import { S3Service } from '../s3/s3.service';
import { Request } from 'express';
import { ChatListItem, ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly s3Service: S3Service,
  ) {}

  @Get('list')
  async getMyChatList(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ): Promise<ChatListItem[]> {
    const userId = req.user.id as string;
    const take = limit ? parseInt(limit, 10) : 20;
    const offset = skip ? parseInt(skip, 10) : 0;

    return await this.chatService.getMyChatList(userId, take, offset);
  }

  @Get('history/:contactId')
  async getChatHistory(
    @Req() req: Request,
    @Param('contactId') contactId: string,
  ): Promise<any> {
    const userId = req.user!.id;

    return await this.chatService.getChatHistory(userId, contactId);
  }

  @Post('start/:receiverId')
  async startConversation(
    @Req() req: Request,
    @Param('receiverId', ParseUUIDPipe) receiverId: string,
  ): Promise<any> {
    const senderId = req.user!.id;
    return await this.chatService.startChat(senderId, receiverId);
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) return [];

    try {
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const isImage = file.mimetype.startsWith('image/');
          const isVideo = file.mimetype.startsWith('video/');

          const folder = isImage
            ? 'chat/images'
            : isVideo
              ? 'chat/videos'
              : 'chat/files';
          const type = isImage ? 'IMAGE' : isVideo ? 'VIDEO' : 'FILE';

          const url = await this.s3Service.uploadFile(file, folder);

          return { url, type };
        }),
      );

      return uploadResults;
    } catch (error: any) {
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }
}
