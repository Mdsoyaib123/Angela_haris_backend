import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from '../../common/decorators/public.decorators';
import { HighlightsService } from './highlights.service';
import type { Request, Response } from 'express';
import sendResponse from '../../utils/sendResponse';
import { HighlightsDto } from './dto/highlights.dto';
import { RemoveClipDto } from './dto/remove-clip.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { subscribeStatus, userRole } from '@prisma';
import { Subscription } from 'src/common/decorators/subscription.decorator';

@Controller('highlights')
export class HighlightsController {
  constructor(private highlightService: HighlightsService) {}

  @Post('merge-video')
  @UseInterceptors(FilesInterceptor('clips'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: HighlightsDto,
  })
  async mergeVideo(
    @Req() req: Request,
    @Body() dto: HighlightsDto,
    @UploadedFiles() clips: Express.Multer.File[],
    @Res() res: Response,
  ) {
    const userId = req.user?.id as string;
    console.log('login user id ', userId);
    const userStatus = (req.user as any)?.subscribeStatus;

    console.log('user status ', userStatus);
    const clipCount = clips?.length || 0;

    // Check limits based on subscription status
    if (userStatus === subscribeStatus.FREE) {
      if (clipCount > 3) {
        throw new BadRequestException(
          'Free users can upload a maximum of 3 clips per reel. Please upgrade your subscription to upload more clips.',
        );
      }
    } else if (
      userStatus === subscribeStatus.PRO ||
      userStatus === subscribeStatus.ELITE
    ) {
      if (clipCount > 6) {
        throw new BadRequestException(
          'Pro and Elite users can upload a maximum of 6 clips per reel.',
        );
      }
    }

    const result = await this.highlightService.mergeVideo(userId, dto, clips);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Video merging started successfully',
      data: result,
    });
  }

  @Delete('remove-clip')
  @Roles(userRole.ADMIN)
  async removeClip(@Body() dto: RemoveClipDto, @Res() res: Response) {
    const result = await this.highlightService.removeClip(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Clip removed and video re-merging started',
      data: result,
    });
  }

  @Get()
  async getAllHighlights(@Res() res: Response) {
    const result = await this.highlightService.getAllHighlights();

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Highlights retrieved successfully',
      data: result,
    });
  }

  @Public()
  @Patch('like/:id')
  async incrementLike(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = req.user?.id as string;
    const result = await this.highlightService.incrementLike(id, userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Highlight like incremented successfully',
      data: result,
    });
  }

  @Delete('deleteHighlights/:id')
  @Subscription(subscribeStatus.ELITE, subscribeStatus.PRO)
  async deleteHighlight(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = req.user?.id as string;
    const role = req.user?.role as string | undefined;
    const result = await this.highlightService.deleteHighlight(
      id,
      userId,
      role,
    );

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Highlight deleted successfully',
      data: result,
    });
  }

  @Public()
  @Get(':id')
  async incrementView(@Param('id') id: string, @Res() res: Response) {
    const result = await this.highlightService.incrementView(id);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Highlight retrieved successfully',
      data: result,
    });
  }
}
