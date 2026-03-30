// update-user.dto.ts
import {
  IsEmail,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// Helper: convert empty strings to undefined so @IsOptional() skips them
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));

export class UpdateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the athlete',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  athleteFullName?: string;

  @ApiProperty({
    example: '2005-08-15',
    description: 'Date of birth (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address (must be unique)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  // Optional personal/academic info
  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  parentName?: string;

  @ApiProperty({ example: 'New York', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Add your Bio', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'NY', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  state?: string;

  @ApiProperty({ example: 2026, required: false })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2035)
  gradYear?: number;

  @ApiProperty({ example: 'Basketball', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  sports?: string;

  @ApiProperty({ example: 'Left', required: false })
  @IsOptional()
  @IsString()
  dominateHand?: string;


  @ApiProperty({ example: 23, required: false })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  jerseyNumber?: number;

  @ApiProperty({ example: 'Quarterback', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  position?: string;

  @ApiProperty({ example: 180.5, required: false })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'Height must be a number' })
  @Min(0)
  height?: number;

  @ApiProperty({ example: 75.2, required: false })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0)
  weight?: number;

  @ApiProperty({ example: 'Lincoln High School', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  school?: string;

  @ApiProperty({ example: 3.75, required: false })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'GPA must be a number with up to 2 decimal places' },
  )
  @Min(0.0)
  @Max(4.0)
  gpa?: number;

  @ApiProperty({
    example: 'Head Coach',
    description: 'Admin title',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  adminTilte?: string;

  @ApiProperty({ example: 'fcm_token_abc123', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  fcmToken?: string;

  // 🔹 Profile Image (for Swagger file upload)
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Profile image file',
    required: false,
  })
  @IsOptional()
  image?: any;

  // 🔹 Basketball Performance Stats
  @ApiProperty({
    example: 22.5,
    description: 'Points Per Game (PPG)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'PPG must be a number' })
  @Min(0)
  ppg?: number;

  @ApiProperty({
    example: 8.3,
    description: 'Rebounds Per Game (RPG)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'RPG must be a number' })
  @Min(0)
  rpg?: number;

  @ApiProperty({
    example: 5.7,
    description: 'Assists Per Game (APG)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'APG must be a number' })
  @Min(0)
  apg?: number;

  @ApiProperty({
    example: 2.1,
    description: 'Steals Per Game (SPG)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'SPG must be a number' })
  @Min(0)
  spg?: number;

  @ApiProperty({
    example: 1.8,
    description: 'Blocks Per Game (BLK)',
    required: false,
  })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber({}, { message: 'BLK must be a number' })
  @Min(0)
  blk?: number;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ example: 'Elite Basketball Club', required: false })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  clubTeam?: string;
}
