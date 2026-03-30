import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  ValidateNested,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['IMAGE', 'VIDEO', 'FILE']) // স্কিমা অনুযায়ী ভ্যালিডেশন
  fileType: string;
}

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty({ message: 'ConversationId is required' })
  conversationId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'receiverId is required' })
  receiverId: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((o) => !o.files || o.files.length === 0)
  @IsNotEmpty({
    message: 'Message content cannot be empty if no files are attached',
  })
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  files?: AttachmentDto[];
}
