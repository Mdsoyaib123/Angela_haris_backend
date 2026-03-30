import { ApiProperty } from '@nestjs/swagger';
import { subscribeStatus } from '@prisma';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Full name', example: 'Alice Johnson' })
  athleteFullName: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Email address',
    example: 'alicejohnson@gmail.com',
  })
  email: string;

  @IsEnum(['ADMIN', 'USER', 'ATHLATE'])
  @IsNotEmpty()
  @ApiProperty({
    description: ' role',
    enum: ['ADMIN', 'USER', 'ATHLATE', 'PARENT'],
    example: 'ATHLATE',
  })
  systemRole: string;

  @IsEnum(subscribeStatus)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Subscription plan',
    enum: subscribeStatus,
    example: 'FREE',
  })
  subscriptionPlan: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Password',
    example: '123456',
  })
  password: string;

  @IsNotEmpty()
  @ApiProperty({ description: 'Plan ID', example: '12345678' })
  planId: string;
}

export class UpdateUserPlanDto {
  @IsNotEmpty()
  @ApiProperty({ description: 'User ID', example: '12345678' })
  userId: string;

  @IsNotEmpty()
  @ApiProperty({
    description: ' planId',
    example: '34355454',
  })
  planId: string; // 🔥 IMPORTANT
}
