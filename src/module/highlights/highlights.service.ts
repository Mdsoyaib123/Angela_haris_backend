/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { HighlightsDto } from './dto/highlights.dto';
import { RemoveClipDto } from './dto/remove-clip.dto';
import Ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { Readable } from 'stream';
import { Express } from 'express';
// import * as Ffmpeg from 'fluent-ffmpeg';
import pLimit from 'p-limit';

// Ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
// Ffmpeg.setFfprobePath('/opt/homebrew/bin/ffprobe');

@Injectable()
export class HighlightsService {
  private readonly logger = new Logger(HighlightsService.name);

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {
    // ✅ FORCE AWS PATH
    // Ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    // Ffmpeg.setFfprobePath('/usr/bin/ffprobe');

  }



  // async mergeVideo(
  //   userId: string,
  //   dto: HighlightsDto,
  //   files: Express.Multer.File[],
  // ) {
  //   try {
  //     if (!files || files.length < 1) {
  //       throw new BadRequestException(
  //         'At least 1 video clip is required for merging',
  //       );
  //     }

  //     // New: Validate duration of each clip (max 15 seconds)
  //     for (const file of files) {
  //       const duration = await this.s3Service.getVideoDuration(file);
  //       if (duration > 15) {
  //         throw new BadRequestException(
  //           `Clip "${file.originalname}" is ${duration.toFixed(
  //             1,
  //           )}s long. Each clip must be 15 seconds or less.`,
  //         );
  //       }
  //     }

  //     // 1. Create a highlight record in the database with isProcessing = true
  //     // We store an initial placeholder for clips, which we'll update soon
  //     const highlight = await this.prisma.client.highlights.create({
  //       data: {
  //         caption: dto.caption,
  //         description: dto.description,
  //         userId: userId,
  //         clips: [] as any,
  //         isProcessing: true,
  //       },
  //     });

  //     try {
  //       // 2. Upload each clip to S3 and collect information
  //       const uploadedClips = [];
  //       for (let i = 0; i < files.length; i++) {
  //         const file = files[i];
  //         const url = await this.s3Service.uploadVideo(file);
  //         const s3Key = this.s3Service.extractKeyFromUrl(url);

  //         uploadedClips.push({
  //           key: file.originalname,
  //           s3Key: s3Key,
  //           url: url,
  //           order: i,
  //         });
  //       }

  //       // 3. Perform video merging
  //       const mergedVideoUrl = await this.s3Service.mergeVideos(
  //         uploadedClips.map((c) => ({ s3Key: c.s3Key, order: c.order })),
  //       );
  //       // 4. Update the highlight record with the merged video URL and final clip list
  //       const updatedHighlight = await this.prisma.client.highlights.update({
  //         where: { id: highlight.id },
  //         data: {
  //           mergedVideoUrl: mergedVideoUrl,
  //           clips: uploadedClips as any,
  //           isProcessing: false,
  //           highLightsLink: mergedVideoUrl,
  //         },
  //       });

  //       return updatedHighlight;
  //     } catch (error) {
  //       // If merging fails, we should still set isProcessing = false
  //       await this.prisma.client.highlights
  //         .update({
  //           where: { id: highlight.id },
  //           data: { isProcessing: false },
  //         })
  //         .catch(() => {}); // Ignore update error if it happens during error handling
  //       throw error;
  //     }
  //   } catch (error) {
  //     if (
  //       error instanceof InternalServerErrorException ||
  //       error instanceof BadRequestException
  //     ) {
  //       throw error;
  //     }
  //     throw new InternalServerErrorException(
  //       `Failed to process video merging: ${error.message}`,
  //     );
  //   }
  // }



  async mergeVideo(
    userId: string,
    dto: HighlightsDto,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least 1 video clip is required for merging',
      );
    }

    // ✅ File type validation
    const allowedExtensions = ['mp4', 'mov'];
    files.forEach((file) => {
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        throw new BadRequestException(
          `Unsupported file format: ${file.originalname}. Only MP4 and MOV are allowed.`,
        );
      }
    });

    try {
      /* 1️⃣ Validate durations (LIMITED concurrency) */
      const durationLimit = pLimit(3);

      await Promise.all(
        files.map((file) =>
          durationLimit(async () => {
            const duration = await this.s3Service.getVideoDuration(file);

            if (duration > 15) {
              throw new BadRequestException(
                `Clip "${file.originalname}" is ${duration.toFixed(
                  1,
                )}s long. Each clip must be ≤ 15 seconds.`,
              );
            }
          }),
        ),
      );

      /* 2️⃣ Create highlight record */
      const highlight = await this.prisma.client.highlights.create({
        data: {
          caption: dto.caption,
          description: dto.description,
          userId,
          clips: [],
          isProcessing: true,
        },
      });

      try {
        /* 3️⃣ Compress + Upload (LIMITED concurrency) */
        const limit = pLimit(3);

        const uploadedClips = await Promise.all(
          files.map((file, index) =>
            limit(async () => {
              let compressedPath: string | null = null;

              try {
                let url: string;

                // ✅ Skip compression if small file (<3MB)
                if (file.size < 3 * 1024 * 1024) {
                  this.logger.log(`Skipping compression: ${file.originalname}`);

                  url = await this.s3Service.uploadVideo(file);
                } else {
                  compressedPath = await this.compressVideo(file);

                  url = await this.s3Service.uploadVideoFromPath(
                    compressedPath,
                    file.originalname,
                  );
                }

                const s3Key = this.s3Service.extractKeyFromUrl(url);

                return {
                  key: file.originalname,
                  s3Key,
                  url,
                  order: index,
                };
              } catch (error) {
                this.logger.error(
                  `Failed processing clip: ${file.originalname}`,
                  error.stack,
                );
                throw error;
              } finally {
                if (compressedPath) {
                  await fs.unlink(compressedPath).catch(() => { });
                }
              }
            }),
          ),
        );

        /* 4️⃣ Merge */
        const mergedVideoUrl = await this.s3Service.mergeVideos(
          uploadedClips.map((clip) => ({
            s3Key: clip.s3Key,
            order: clip.order,
          })),
        );

        /* 5️⃣ Update DB */
        return await this.prisma.client.highlights.update({
          where: { id: highlight.id },
          data: {
            mergedVideoUrl,
            clips: uploadedClips,
            isProcessing: false,
            highLightsLink: mergedVideoUrl,
          },
        });
      } catch (error) {
        await this.prisma.client.highlights
          .update({
            where: { id: highlight.id },
            data: { isProcessing: false },
          })
          .catch(() => { });

        throw error;
      }
    } catch (error) {
      this.logger.error('Video merging failed', error.stack);

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to process video merging: ${error.message}`,
      );
    }
  }

  /* --- Helper: Compress Video using FFmpeg --- */
  private async compressVideo(file: Express.Multer.File): Promise<string> {
    const tempDir = `/tmp/compress_${uuidv4()}`;
    await fs.mkdir(tempDir, { recursive: true });

    const inputPath = join(tempDir, `input_${uuidv4()}_${file.originalname}`);
    const outputPath = join(tempDir, `compressed_${uuidv4()}.mp4`);

    try {
      // ✅ Save buffer → file (required for ffmpeg)
      await fs.writeFile(inputPath, file.buffer);

      return await new Promise<string>((resolve, reject) => {
        Ffmpeg(inputPath)
          // ✅ Helps ffmpeg properly read iPhone files
          .inputOptions([
            '-analyzeduration 100M',
            '-probesize 100M',
          ])
          .outputOptions([
            // ✅ CRITICAL: avoid broken streams (iPhone fix)
            '-map 0:v:0',
            '-map 0:a:0?',

            // ✅ codecs
            '-c:v libx264',
            '-c:a aac',

            // ✅ performance tuning
            '-preset ultrafast',
            '-crf 30',
            '-threads 2',

            // ✅ normalize fps (iPhone uses variable fps)
            '-r 24',

            // ✅ streaming optimization
            '-movflags +faststart',

            // ✅ compatibility
            '-pix_fmt yuv420p',

            // ✅ resize + normalize format
            '-vf scale=854:-2,format=yuv420p',

            // ✅ prevent duration mismatch
            '-shortest',
          ])
          .on('start', (cmd) => {
            this.logger.log(`FFmpeg started: ${cmd}`);
          })
          .on('end', () => {
            this.logger.log(`Video compressed successfully: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (err, stdout, stderr) => {
            this.logger.error(`FFmpeg FAILED`);
            this.logger.error(`Error: ${err.message}`);
            this.logger.error(`STDERR: ${stderr}`);
            this.logger.error(`STDOUT: ${stdout}`);

            reject(
              new InternalServerErrorException(
                `Video compression failed: ${stderr || err.message}`,
              ),
            );
          })
          .save(outputPath);
      });
    } finally {
      // ✅ cleanup input file
      await fs.unlink(inputPath).catch(() => { });
    }
  }

  async removeClip(dto: RemoveClipDto) {
    // 1. Find the highlight
    const highlight = await this.prisma.client.highlights.findUnique({
      where: { id: dto.highlightId },
    });

    if (!highlight) {
      throw new BadRequestException('Highlight not found');
    }

    const clips = (highlight.clips as any[]) || [];
    const clipIndex = clips.findIndex((c) => c.order === dto.order);

    if (clipIndex === -1) {
      throw new BadRequestException('Clip with specified order not found');
    }

    const clipToRemove = clips[clipIndex];
    const remainingClips = clips.filter((_, index) => index !== clipIndex);

    // 2. Re-order remaining clips to maintain sequence
    const updatedClips = remainingClips.map((c, index) => ({
      ...c,
      order: index,
    }));

    // 3. Update database with isProcessing = true
    await this.prisma.client.highlights.update({
      where: { id: highlight.id },
      data: { isProcessing: true },
    });

    try {
      // 4. Delete the clip from S3
      if (clipToRemove.url) {
        await this.s3Service.deleteFile(clipToRemove.url).catch((err) => {
          this.logger.error(`Failed to delete clip from S3: ${err.message}`);
        });
      }

      // 5. Delete the old merged video from S3
      if (highlight.mergedVideoUrl) {
        await this.s3Service
          .deleteFile(highlight.mergedVideoUrl)
          .catch((err) => {
            this.logger.error(
              `Failed to delete old merged video from S3: ${err.message}`,
            );
          });
      }

      // 6. Re-merge if there are at least 2 clips remaining
      let newMergedVideoUrl = null;
      if (updatedClips.length >= 1) {
        newMergedVideoUrl = await this.s3Service.mergeVideos(
          updatedClips.map((c) => ({ s3Key: c.s3Key, order: c.order })),
        );
      }

      // 7. Final update
      const result = await this.prisma.client.highlights.update({
        where: { id: highlight.id },
        data: {
          clips: updatedClips as any,
          mergedVideoUrl: newMergedVideoUrl,
          highLightsLink: newMergedVideoUrl,
          isProcessing: false,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.client.highlights
        .update({
          where: { id: highlight.id },
          data: { isProcessing: false },
        })
        .catch(() => { });
      throw new InternalServerErrorException(
        `Failed to remove clip and re-merge: ${error.message}`,
      );
    }
  }

  async getAllHighlights() {
    return this.prisma.client.highlights.findMany({
      include: {
        user: {
          select: {
            id: true,
            athleteFullName: true,
            imgUrl: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async incrementLike(highlightId: string, userId: string) {
    // 1. Verify the highlight exists
    const highlight = await this.prisma.client.highlights.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new BadRequestException('Highlight not found');
    }

    // 2. Check if the user has already liked this highlight
    const existingLike = await this.prisma.client.likeHighlights.findUnique({
      where: {
        userId_highlightId: {
          userId,
          highlightId,
        },
      },
    });

    if (existingLike) {
      // --- UNLIKE LOGIC ---
      // Delete the like record
      await this.prisma.client.likeHighlights.delete({
        where: {
          id: existingLike.id, // Assuming 'id' is the primary key of the like table
          // OR use your composite key if no single ID exists:
          // userId_highlightId: { userId, highlightId }
        },
      });

      // Decrement the like count on the highlight
      return this.prisma.client.highlights.update({
        where: { id: highlightId },
        data: {
          likes: { decrement: 1 },
        },
      });
    } else {
      // --- LIKE LOGIC ---
      // Create the new like record
      await this.prisma.client.likeHighlights.create({
        data: {
          userId,
          highlightId,
        },
      });

      // Increment the like count on the highlight
      return this.prisma.client.highlights.update({
        where: { id: highlightId },
        data: {
          likes: { increment: 1 },
        },
      });
    }
  }

  async incrementView(highlightId: string) {
    const highlight = await this.prisma.client.highlights.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new BadRequestException('Highlight not found');
    }

    return highlight;
  }

  async deleteHighlight(
    highlightId: string,
    userId: string,
    userRole?: string,
  ) {
    const highlight = await this.prisma.client.highlights.findUnique({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    const clips = (highlight.clips as any[]) || [];
    const urlsToDelete = [
      ...clips.map((c) => c?.url).filter(Boolean),
      highlight.mergedVideoUrl,
    ].filter(Boolean) as string[];

    for (const url of urlsToDelete) {
      await this.s3Service.deleteFile(url);
    }

    await this.prisma.client.$transaction([
      this.prisma.client.likeHighlights.deleteMany({
        where: { highlightId },
      }),
      this.prisma.client.highlights.delete({
        where: { id: highlightId },
      }),
    ]);

    return { message: 'Highlight deleted successfully' };
  }
}
