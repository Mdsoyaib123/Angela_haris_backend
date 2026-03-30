// src/common/decorators/subscription.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { subscribeStatus } from '@prisma';

export const SUBSCRIPTION_KEY = 'subscriptions';
export const Subscription = (...status: subscribeStatus[]) =>
  SetMetadata(SUBSCRIPTION_KEY, status);
