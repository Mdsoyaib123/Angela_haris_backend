import {
  ArgumentMetadata,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { CommentService } from '../comment.service';

@Injectable()
export class PostExistsPipe implements PipeTransform {
  constructor(private readonly commentService: CommentService) {}

  async transform(value: string, metadata: ArgumentMetadata) {
    try {
      await this.commentService.findOne(value);
    } catch (error) {
      throw new NotFoundException(`Comment with ID ${value} not found`);
    }
    return value;
  }
}
