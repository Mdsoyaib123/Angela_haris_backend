import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // যদি Swagger ব্যবহার করেন

export class UpdateCommentDto {
  @ApiProperty({
    description: 'The updated content of the comment',
    example: 'This is an updated comment!',
  })
  @IsNotEmpty({ message: 'Comment content cannot be empty' })
  @IsString({ message: 'Comment must be a string' })
  @MinLength(1, { message: 'Comment is too short' })
  content: string;
}
