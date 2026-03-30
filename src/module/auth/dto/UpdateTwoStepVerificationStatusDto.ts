import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class UpdateTwoStepVerificationStatusDto {
  @IsString()
  @ApiProperty({
    example: '834783748',
    description: 'userId ',
  })
  userId: string;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Two step verification status to update',
  })
  isTwoStepVerification: boolean;
}

export class VerifyTwoStepVerificationDto {
  @IsString()
  @ApiProperty({
    example: '834783748',
    description: 'userId ',
  })
  userId: string;

  @IsString()
  @ApiProperty({
    example: '834783748',
    description: 'code ',
  })
  code: string;
}
