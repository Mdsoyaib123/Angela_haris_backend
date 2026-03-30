import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './module/prisma/prisma.module';
import { AuthModule } from './module/auth/auth.module';
import { HighlightsModule } from './module/highlights/highlights.module';
import { StripeModule } from './module/stripe/stripe.module';
import { EmailModule } from './module/email/email.module';
import { SeederService } from './seeder/seeder.service';
import { AdminModule } from './module/admin/admin.module';
import { PostModule } from './module/post/post.module';
import { LikeModule } from './module/like/like.module';
import { CommentModule } from './module/comment/comment.module';
import { NotificationModule } from './module/notification/notification.module';
import { ChatModule } from './module/chat/chat.module';
import { FeedModule } from './module/feed/feed.module';
import { OrganizationModule } from './module/organization/organization.module';
import { SendRoadMapAndOrganizationNameModule } from './module/send-road-map-and-organization-name/send-road-map-and-organization-name.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    HighlightsModule,
    StripeModule,
    EmailModule,
    AdminModule,
    // miraz vai
    PostModule,
    LikeModule,
    CommentModule,
    NotificationModule,
    ChatModule,
    FeedModule,
    OrganizationModule,
    SendRoadMapAndOrganizationNameModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeederService],
})
export class AppModule {}
