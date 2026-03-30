import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({
    example: 'recipient@example.com',
    description: 'The email address of the recipient',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'Hello!',
    description: 'The subject of the email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  subject: string;

  @ApiProperty({
    example: 'This is a test email content.',
    description: 'The content/body of the email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @ApiProperty({
    example: 'John',
    description: 'The name of the user',
    required: false,
  })
  @IsString()
  @IsOptional()
  userName?: string;
}
