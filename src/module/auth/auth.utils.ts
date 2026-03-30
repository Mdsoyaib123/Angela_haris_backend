// src/auth/utils/auth-utils.ts

import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, subscribeStatus, userRole } from '@prisma';
import { BadRequestException } from '@nestjs/common';

export async function getTokens(
  jwtService: JwtService,
  userId: string,
  email: string,
  role: userRole,
  subscribeStatus: subscribeStatus,
  expiresIn?: string,
) {
  const [access_token, refresh_token] = await Promise.all([
    jwtService.signAsync(
      { id: userId, email, role, subscribeStatus },

      {
        secret: process.env.ACCESS_TOKEN_SECRET,
        expiresIn: expiresIn || process.env.ACCESS_TOKEN_EXPIREIN,
      } as any,
    ),
    jwtService.signAsync({ id: userId, email, role, subscribeStatus }, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIREIN,
    } as any),
  ]);

  return { access_token, refresh_token };
}

export function generateOtpCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function hashOtpCode(code: string) {
  return bcrypt.hash(code, parseInt(process.env.SALT_ROUND!));
}

export async function verifyOtp(
  prisma: PrismaClient,
  email: string,
  code: string,
) {
  const otpRecord = await prisma.otpCode.findFirst({
    where: { email, verified: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord || otpRecord.expiresAt < new Date()) {
    throw new BadRequestException('Invalid or expired code');
  }

  const isValid = await bcrypt.compare(code, otpRecord.code);
  if (!isValid) {
    throw new BadRequestException('Incorrect code');
  }

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { verified: true },
  });

  return { message: 'OTP verified successfully' };
}
