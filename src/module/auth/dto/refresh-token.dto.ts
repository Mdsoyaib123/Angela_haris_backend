import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token used to get a new access token',
    type: String,
  })
  refreshToken: string;
}
