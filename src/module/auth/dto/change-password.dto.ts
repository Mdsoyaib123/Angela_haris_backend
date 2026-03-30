// change-password.dto.ts
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'oldSecurePass123',
    description: 'Current password',
  })
  @IsNotEmpty({ message: 'Old password is required' })
  @IsString()
  oldPassword: string;

  @ApiProperty({
    example: 'newSecurePass456',
    description:
      'New password (min 6 characters, must contain at least 1 letter and 1 number)',
  })
  @IsNotEmpty({ message: 'New password is required' })
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword: string;
}
