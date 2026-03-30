// admin-query.dto.ts
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserAction {
  DELETE = 'delete',
  DEACTIVATE = 'deactivate',
  ACTIVATE = 'activate',
}

export class ManageUserQueryDto {
  @ApiPropertyOptional({
    enum: UserAction,
    description:
      'Action to perform on user: delete (soft), deactivate, or activate',
    example: 'delete',
  })
  @IsEnum(UserAction)
  @IsOptional()
  action?: UserAction;
}
