import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: 'An array of URLs for images or videos',
    type: [String],
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
  })
  @IsArray({ message: 'urls must be an array' })
  @IsNotEmpty({ message: 'At least one URL is required' })
  @ArrayMinSize(1, { message: 'At least one image URL must be provided' })
  @IsUrl({}, { each: true, message: 'Each URL must be a valid URL format' })
  urls: string[];

  @ApiPropertyOptional({ description: 'A short description or caption' })
  @IsOptional()
  @IsString({ message: 'Caption must be a string' })
  caption?: string;
}
