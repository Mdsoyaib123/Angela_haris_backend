import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class SendRoadmapDto {
  @ApiProperty({ example: 'org@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class SendOrganizationNameDto {
  @ApiProperty({ example: 'Organization Name' })
  @IsNotEmpty()
  organizationName: string;

  @ApiProperty({ example: 'org@example.com' })
  @IsNotEmpty()
  @IsEmail()
  Organizationemail: string;
}

export class ContactDto {
    @ApiProperty({ example: 'soyaib' })
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

    @ApiProperty({ example: 'Hossain' })
  @IsNotEmpty()
  @MinLength(2)
  lastName: string;

    @ApiProperty({ example: 'org@example.com' })
  @IsEmail()
  email: string;

    @ApiProperty({ example: '342342423423' })
  @IsOptional()
  phoneNumber?: string;

    @ApiProperty({ example: 'PARENT' })
  @IsNotEmpty()
  role: string;

    @ApiProperty({ example: 'com' })
  @IsNotEmpty()
  subject: string;

    @ApiProperty({ example: 'DSJFJ KDFJDLKF KJDFJDK FDKJFKDSF DJFKDSJFKDKF DJFKDJKFD ' })
  @IsNotEmpty()
  @MinLength(20)
  message: string;
}