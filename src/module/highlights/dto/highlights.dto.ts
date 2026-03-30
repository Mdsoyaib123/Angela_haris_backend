import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class HighlightsDto {
  @ApiProperty({
    example: 'Best moments from the game!',
    description: 'Short caption for the highlight',
  })
  @IsString()
  caption: string;

  @ApiProperty({
    example: 'A compilation of top plays from the championship match.',
    description: 'Detailed description of the highlight',
  })
  @IsString()
  description: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Array of video clips to be merged',
  })
  clips: any[];
}
