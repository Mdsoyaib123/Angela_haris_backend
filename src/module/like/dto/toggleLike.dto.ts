import { IsEnum, IsNotEmpty } from 'class-validator';

export enum FeedType {
  POST = 'POST',
  HIGHLIGHT = 'HIGHLIGHT',
}

export class ToggleLikeDto {
  @IsNotEmpty({ message: 'feedType is required' })
  @IsEnum(FeedType, { message: 'feedType must be either POST or HIGHLIGHT' })
  feedType: FeedType;
}
