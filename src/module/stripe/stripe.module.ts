import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeController } from './stripe.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
  imports: [PrismaModule, NotificationModule],
})
export class StripeModule {}
