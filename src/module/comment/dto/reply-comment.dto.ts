import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ReplyCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsUUID()
  postId: string;

  @IsNotEmpty()
  @IsUUID()
  parentId: string;
}
