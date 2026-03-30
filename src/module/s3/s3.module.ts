// src/module/s3/s3.module.ts
import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
