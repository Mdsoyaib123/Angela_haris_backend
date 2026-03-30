import {
  ArgumentMetadata,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { PostService } from 'src/module/post/post.service';

@Injectable()
export class PostExistsPipe implements PipeTransform {
  constructor(private readonly postService: PostService) {}

  async transform(value: string, metadata: ArgumentMetadata) {
    try {
      await this.postService.findOne(value);
    } catch (error) {
      throw new NotFoundException(`Post with ID ${value} not found`);
    }
    return value;
  }
}
