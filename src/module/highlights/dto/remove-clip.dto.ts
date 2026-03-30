import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class RemoveClipDto {
  @ApiProperty({
    example: 'cmlc3mqvf0000rcwa6ajj9w24',
    description: 'ID of the highlight to modify',
  })
  @IsString()
  highlightId: string;

  @ApiProperty({
    example: 1,
    description: 'The order index of the clip to remove',
  })
  @IsNumber()
  order: number;
}
