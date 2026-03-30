import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { AuthModule } from '../auth/auth.module';
import { S3Service } from '../s3/s3.service';

@Module({
  imports: [AuthModule],
  controllers: [PostController],
  providers: [PostService, S3Service],
})
export class PostModule {}
