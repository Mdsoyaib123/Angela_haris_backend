import { Module } from '@nestjs/common';
import { HighlightsService } from './highlights.service';
import { HighlightsController } from './highlights.controller';

@Module({
  providers: [HighlightsService],
  controllers: [HighlightsController],
})
export class HighlightsModule {}
