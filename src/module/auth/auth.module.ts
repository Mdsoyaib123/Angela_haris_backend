import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Module } from '../s3/s3.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: await configService.getOrThrow('ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: await configService.getOrThrow('ACCESS_TOKEN_EXPIREIN'),
        },
      }),
    }),
    S3Module,
    EmailModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
