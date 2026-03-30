import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import Ffmpeg from 'fluent-ffmpeg';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Service } from './s3.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('fluent-ffmpeg', () => {
  const ffmpegMock: any = jest.fn();
  ffmpegMock.setFfmpegPath = jest.fn();
  ffmpegMock.setFfprobePath = jest.fn();
  ffmpegMock.ffprobe = jest.fn();
  return ffmpegMock;
});

describe('S3Service mergeVideos audio regression', () => {
  let service: S3Service;

  const configServiceMock = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'AWS_REGION':
          return 'us-east-1';
        case 'AWS_ACCESS_KEY_ID':
          return 'test-access-key';
        case 'AWS_SECRET_ACCESS_KEY':
          return 'test-secret-key';
        case 'AWS_S3_BUCKET':
          return 'test-bucket';
        default:
          return undefined;
      }
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new S3Service(configServiceMock);
  });

  it('keeps audio mapping/options when merging clips with and without audio', async () => {
    const ffprobeMock = Ffmpeg.ffprobe as jest.Mock;
    ffprobeMock
      .mockImplementationOnce((_: string, cb: Function) =>
        cb(null, {
          streams: [{ codec_type: 'video' }, { codec_type: 'audio' }],
          format: { duration: 3.2 },
        }),
      )
      .mockImplementationOnce((_: string, cb: Function) =>
        cb(null, {
          streams: [{ codec_type: 'video' }],
          format: { duration: 2.8 },
        }),
      );

    const downloadSpy = jest
      .spyOn(service, 'downloadFileFromS3')
      .mockResolvedValue(undefined);

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('merged-video'));
    (fs.rm as jest.Mock).mockResolvedValue(undefined);

    const uploadDone = jest.fn().mockResolvedValue(undefined);
    (Upload as unknown as jest.Mock).mockImplementation(() => ({
      done: uploadDone,
    }));

    const ffmpegChain: Record<string, jest.Mock> = {
      input: jest.fn().mockReturnThis(),
      complexFilter: jest.fn().mockReturnThis(),
      map: jest.fn().mockReturnThis(),
      videoCodec: jest.fn().mockReturnThis(),
      audioCodec: jest.fn().mockReturnThis(),
      outputOptions: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      save: jest.fn(),
    };

    (Ffmpeg as unknown as jest.Mock).mockImplementation(() => ffmpegChain);

    ffmpegChain.save.mockImplementation(() => {
      const endHandler = ffmpegChain.on.mock.calls.find(
        ([event]) => event === 'end',
      )?.[1];
      if (endHandler) endHandler();
      return ffmpegChain;
    });

    await service.mergeVideos([
      { s3Key: 'videos/clip-1.mp4', order: 0 },
      { s3Key: 'videos/clip-2.mp4', order: 1 },
    ]);

    expect(downloadSpy).toHaveBeenCalledTimes(2);

    const filterArg = ffmpegChain.complexFilter.mock.calls[0][0] as string;
    expect(filterArg).toContain('[0:a]aformat=');
    expect(filterArg).toContain('aresample=async=1:first_pts=0');
    expect(filterArg).toContain(
      'anullsrc=channel_layout=stereo:sample_rate=44100',
    );
    expect(filterArg).toContain('concat=n=2:v=1:a=1[outv][outa]');

    expect(ffmpegChain.map).toHaveBeenNthCalledWith(1, '[outv]');
    expect(ffmpegChain.map).toHaveBeenNthCalledWith(2, '[outa]');

    const outputOptionsArg = ffmpegChain.outputOptions.mock
      .calls[0][0] as string[];
    expect(outputOptionsArg).toEqual(
      expect.arrayContaining(['-ar 44100', '-ac 2', '-movflags +faststart']),
    );

    expect(uploadDone).toHaveBeenCalledTimes(1);
  });
});
