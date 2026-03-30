// src/common/guards/subscription.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUBSCRIPTION_KEY } from '../decorators/subscription.decorator';
import { PrismaService } from 'src/module/prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredStatus = this.reflector.getAllAndOverride<string[]>(
      SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific subscription is required, allow access
    if (!requiredStatus || requiredStatus.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Ensure user exists (should be handled by JwtGuard first)
    if (!user) throw new ForbiddenException('No user found');

    // Special allowance for ADMIN (admins usually bypass subscription restrictions)
    if (user.role === 'ADMIN') return true;

    const existingUser = await this.prisma.client.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        subscribeStatus: true,
      },
    });

    if (!existingUser) {
      throw new ForbiddenException('User not found');
    }

    const currentSubscribeStatus = existingUser.subscribeStatus || 'FREE';

    // Keep request user subscription status in sync for downstream handlers
    user.subscribeStatus = currentSubscribeStatus;

    // Check if latest user status is in allowed list
    if (!requiredStatus.includes(currentSubscribeStatus)) {
      throw new ForbiddenException(
        'Your current subscription level does not permit access to this resource',
      );
    }

    return true;
  }
}
