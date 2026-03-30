// create-product.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  IsBoolean,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'The name of the subscription plan',
    example: 'Premium Plan',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'A brief description of the plan (optional)',
    example: 'Access to all premium features',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price amount in cents (e.g., 999 = $9.99)',
    example: 999,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217). Defaults to "usd"',
    example: 'usd',
    default: 'usd',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Billing interval for subscription',
    enum: ['month', 'year'],
    example: 'month',
    default: 'month',
    required: false,
  })
  @IsString()
  @IsIn(['month', 'year'])
  @IsOptional()
  interval?: 'month' | 'year';

  @ApiProperty({
    description: 'List of features included in the plan',
    example: ['Daily horoscopes', 'Ad-free experience', 'Priority support'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiProperty({
    description: 'Mark this plan as popular (for UI badge)',
    example: true,
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;
}

export class UpdatePlanDto {
  @ApiProperty({ required: false, example: 'Pro Plan' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, example: 'Best plan ever' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    example: 19.99,
    description: 'New price in dollars (e.g., 19.99)',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({
    required: false,
    example: 'usd',
    description:
      'Currency code (ISO 4217). Note: Changing this creates a new Stripe Price.',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    required: false,
    example: ['Feature 1', 'Feature 2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;
}

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Stripe Price ID (e.g., price_123...)',
    example: 'price_1Nxabc...',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;
}

export class TransferOrganizationCommissionDto {
  @ApiProperty({
    description: 'Amount to transfer to organization in dollars',
    example: 25,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'usd',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;
}
