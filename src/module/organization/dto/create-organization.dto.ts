import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'ORG_001' })
  @IsString()
  @IsNotEmpty()
  organizationCode: string;

  @ApiProperty({ example: 'Softvence Academy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'org@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+1-202-555-0101', required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ example: 'https://softvence.com', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ example: 'US', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiProperty({ example: 'Suite 10', required: false })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({ example: 'New York', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'NY', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: '10001', required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ example: 'Softvence Academy', required: false })
  @IsString()
  @IsOptional()
  bankAccountHolderName?: string;

  @ApiProperty({ example: 'Bank of America', required: false })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiProperty({ example: '6789', required: false })
  @IsString()
  @IsOptional()
  bankAccountLast4?: string;

  @ApiProperty({ example: '0210', required: false })
  @IsString()
  @IsOptional()
  bankRoutingLast4?: string;

  @ApiProperty({ example: 'US', required: false })
  @IsString()
  @IsOptional()
  bankCountry?: string;

  @ApiProperty({ example: 'usd', required: false })
  @IsString()
  @IsOptional()
  bankCurrency?: string;
}
