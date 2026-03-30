import {
  ArgumentMetadata,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { AuthService } from 'src/module/auth/auth.service';

@Injectable()
export class UserExistsPipe implements PipeTransform {
  constructor(private readonly authService: AuthService) {}

  async transform(value: string, metadata: ArgumentMetadata) {
    try {
      await this.authService.currentUser(value);
    } catch (error) {
      throw new NotFoundException(`Post with ID ${value} not found`);
    }
    return value;
  }
}
