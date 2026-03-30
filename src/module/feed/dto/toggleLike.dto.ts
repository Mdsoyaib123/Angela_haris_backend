import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum FeedType {
  POST = 'POST',
  HIGHLIGHT = 'HIGHLIGHT',
}

export class ToggleLikeDto {
  @IsNotEmpty({ message: 'feedType is required' })
  @IsString({ message: 'feedType must be a string' })
  @IsEnum(FeedType, { message: 'feedType must be either POST or HIGHLIGHT' })
  feedType: FeedType;
}
