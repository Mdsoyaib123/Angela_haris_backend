import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './swagger/swagger.setup';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from './module/prisma/prisma.service';
import { JwtGuard } from './common/guards/jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { SubscriptionGuard } from './common/guards/subscription.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);

  // Configure larger payload limits for video uploads (100MB)
  // useBodyParser ensures NestJS's rawBody support is preserved
  app.useBodyParser('json', { limit: '100mb' });
  app.useBodyParser('urlencoded', { limit: '100mb', extended: true });

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://highlightz.vercel.app',
      'https://highlightzapp.com',
      'https://highlightzapp.co',
      '*',
      'https://highlightz.netlify.app',
    ],
    // origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  const reflector = app.get(Reflector);
  const prisma = app.get(PrismaService);

  app.useGlobalGuards(
    new JwtGuard(reflector, prisma),
    new RolesGuard(reflector),
    new SubscriptionGuard(reflector, prisma),
  );

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  setupSwagger(app);

  await app.listen(configService.get<string>('PORT') || 5000);
}
bootstrap();

// ADD CI/CD PIPELINE
// ADD CI/CD PIPELINE
