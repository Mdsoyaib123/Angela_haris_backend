import {
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePostDto {
  @ApiPropertyOptional({
    description: 'An array of URLs for images or videos',
    type: [String],
    example: ['https://example.com/new-image1.jpg'],
  })
  @IsArray({ message: 'urls must be an array' })
  @IsOptional()
  @ArrayMinSize(1, {
    message: 'If providing urls, at least one image URL must be provided',
  })
  @IsUrl({}, { each: true, message: 'Each URL must be a valid URL format' })
  urls?: string[];

  @ApiPropertyOptional({ description: 'Update the description or caption' })
  @IsOptional()
  @IsString({ message: 'Caption must be a string' })
  caption?: string;
}
