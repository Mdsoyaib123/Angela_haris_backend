import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateShowPlanDto {
  @ApiProperty({
    example: true,
    description: 'Whether the user should see the plan',
  })
  @IsBoolean()
  showPlan: boolean;
}