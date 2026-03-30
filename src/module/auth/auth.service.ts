/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
// import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import {
  generateOtpCode,
  getTokens,
  hashOtpCode,
  verifyOtp,
} from './auth.utils';
// import { SystemRole } from '@prisma';
import { RegisterDto } from './dto/register.dto';
// import { userRole } from '@prisma';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-account.dto';
import { S3Service } from '../s3/s3.service';
import { EmailService } from '../email/email.service';
import { RequestResetCodeDto } from './dto/forgetPasswordDto';
import { ResetPasswordDto } from './dto/forgetPasswordDto';
import { VerifyResetCodeDto } from './dto/forgetPasswordDto';
import type { Request, Response } from 'express';
import sendResponse from 'src/utils/sendResponse';
import * as ejs from 'ejs';
import * as path from 'path';
import { userRole } from '@prisma';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private s3Service: S3Service,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto, imageUrl?: string | null) {
    const role = dto.role?.toString().toUpperCase();

    // Check Email Uniqueness based on Role
    if (role === 'PARENT') {
      // Parent Signup: parentEmail is primary, athlete email optional
      const existingParent = await this.prisma.client.user.findFirst({
        where: {
          OR: [{ email: dto.parentEmail }, { athlateEmail: dto.parentEmail }],
        },
      });
      if (existingParent) {
        throw new BadRequestException('Parent email is already in use!');
      }
    } else if (role === userRole.ATHLATE) {
      // Athlete Signup: Both required and both must be unique
      if (!dto.athlateeEmail || !dto.parentEmail) {
        throw new BadRequestException(
          'Both athlete and parent emails are required for athlete registration!',
        );
      }

      // Check Athlete Email
      const athleteExists = await this.prisma.client.user.findFirst({
        where: {
          OR: [
            { email: dto.athlateeEmail },
            { athlateEmail: dto.athlateeEmail },
          ],
        },
      });
      if (athleteExists) {
        throw new BadRequestException('Athlete email is already in use!');
      }

      // Check Parent Email
      const parentExists = await this.prisma.client.user.findFirst({
        where: {
          OR: [{ email: dto.parentEmail }, { athlateEmail: dto.parentEmail }],
        },
      });
      if (parentExists) {
        throw new BadRequestException('Parent email is already in use!');
      }
    }

    if (dto.organizationCode) {
      await this.prisma.client.organization.updateMany({
        where: { organizationCode: dto.organizationCode },
        data: {
          uniqueVisitors: { increment: 1 },
        },
      });
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      parseInt(process.env.SALT_ROUND!, 10),
    );

    const newUser = await this.prisma.client.user.create({
      data: {
        athleteFullName: dto.athleteFullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        email: dto.parentEmail ?? undefined, // Use athlete email if available, else parent email as primary
        password: hashedPassword,
        imgUrl: imageUrl ?? undefined,
        parentName: dto.parentName ?? undefined,
        parentPhone: dto.parentPhone ?? undefined,
        city: dto.city ?? undefined,
        state: dto.state ?? undefined,
        bio: dto.bio ?? undefined,
        gradYear: dto.gradYear ?? undefined,
        sports: dto.sports ?? undefined,
        position: dto.position ?? undefined,
        height: dto.height ?? undefined,
        weight: dto.weight ?? undefined,
        school: dto.school ?? undefined,
        gpa: dto.gpa ?? undefined,
        dominateHand: dto.dominateHand ?? undefined,
        jerseyNumber: dto.jerseyNumber ?? undefined,
        fcmToken: dto.fcmToken ?? undefined,
        referralCode:
          'REF_' + Math.floor(100000 + Math.random() * 900000).toString(),
        isActive: true,
        athlateEmail: dto.athlateeEmail ?? undefined,
        referredBy: dto.referredBy ?? undefined,
        oranaizaitonCode: dto.organizationCode ?? undefined,
        role: role as userRole,
        phoneNumber: dto.phoneNumber,
        clubTeam: dto.clubTeam ?? undefined,
      },
    });

    const profileLink = process.env.BASE_URL + '/profile/' + newUser.id;

    const updatedUser = await this.prisma.client.user.update({
      where: { id: newUser.id },
      data: { profileLink },
    });

    // const otpCode = generateOtpCode();
    // const hashedOtp = await hashOtpCode(otpCode);
    // const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // await this.prisma.client.otpCode.create({
    //   data: { email: updatedUser.email, code: hashedOtp, expiresAt },
    // });

    // await this.emailService.sendEmail({
    //   to: updatedUser.email,
    //   subject: 'Verify your email',
    //   text: `Your verification code is ${otpCode}. It will expire in 5 minutes.`,
    // });

    const tokens = await getTokens(
      this.jwtService,
      updatedUser.id,
      updatedUser.email,
      updatedUser.role,
      updatedUser.subscribeStatus,
    );

    return { user: updatedUser, ...tokens };
  }

  // login
  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.client.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { athlateEmail: dto.email }],
      },
    });

    if (!user || !dto.password) {
      throw new ForbiddenException('Invalid credentials');
    }

    if (user.isDeleted) {
      throw new BadRequestException('User is deleted!');
    }
    // if (!user.isActive) {
    //   return {isActive: false  ,  access_token: null , refresh_token :null}
    // }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new ForbiddenException('Invalid credentials');
    }

    const tokens = await getTokens(
      this.jwtService,
      user.id,
      user.email,
      user.role,
      user.subscribeStatus,
    );

    // --- START: Login History Logic ---

    // 1. Parse User-Agent
    const userAgent = req.get('user-agent') ?? 'Unknown';

    const os = this.detectOs(userAgent);
    const browser = this.detectBrowser(userAgent);

    // Format: "iPhone 15 Pro - Safari" or "Windows - Chrome"
    const deviceName = `${os} - ${browser}`;

    // 2. Get IP Address (Handle Cloudflare/Render/Proxy)
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.headers['cf-connecting-ip']?.toString() || // Specific to Cloudflare
      req.socket.remoteAddress ||
      'unknown';

    // 3. (Optional) Fetch Location from IP using an external API
    // For production, use a paid service or cache this.
    // Here is a free example using ipapi.co (be careful with rate limits)
    let city = null;
    let region = null;
    let country = null;

    if (ip !== 'unknown' && !ip.includes('127.0.0.1')) {
      try {
        const geoRes = await fetch(`http://ipapi.co/${ip}/json/`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          city = geoData.city;
          region = geoData.region;
          country = geoData.country_name;
        }
      } catch (error) {
        console.error('GeoIP lookup failed:', error);
        // Fallback gracefully if API fails
      }
    }

    // 4. Save to Database
    await this.prisma.client.loginSession.create({
      data: {
        userId: user.id,
        device: deviceName,
        os,
        browser,
        ipAddress: ip,
        city,
        region,
        country,
        isActive: true,
        lastActive: new Date(),
      },
    });
    // --- END: Login History Logic ---

    const otpCode = generateOtpCode();
    const hashedOtp = await hashOtpCode(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.client.otpCode.create({
      data: { email: user.email, code: hashedOtp, expiresAt },
    });

    if (user.isTwoStepVerification) {
      await this.emailService.sendEmail({
        to:
          user.role === 'ATHLATE' ? (user.athlateEmail as string) : user.email,
        subject: 'Verify your email',
        text: `Your verification code is ${otpCode}. It will expire in 5 minutes.`,
      });
    }

    return {
      user,
      isTwoStepVerification: user.isTwoStepVerification,
      ...(user.isTwoStepVerification ? {} : tokens),
    };
  }

  async verifyTwoStepVerification(userId: string, code: string) {
    console.log('verify dto', userId, code);
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found -----');
    }

    const otpCode = await this.prisma.client.otpCode.findFirst({
      where: { email: user.email, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpCode || otpCode.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    const isValid = await bcrypt.compare(code, otpCode.code);
    if (!isValid) {
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.client.otpCode.update({
      where: { id: otpCode.id },
      data: { verified: true },
    });

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: { isTwoStepVerification: true },
      select: {
        id: true,
        email: true,
        role: true,
        subscribeStatus: true,
        isTwoStepVerification: true,
      },
    });

    const tokens = await getTokens(
      this.jwtService,
      updatedUser.id,
      updatedUser.email,
      updatedUser.role,
      updatedUser.subscribeStatus,
    );

    return { user: updatedUser, ...tokens };
  }

  async updateTwoStepVerificationStatus(userId: string, status: any) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return await this.prisma.client.user.update({
      where: { id: userId },
      data: { isTwoStepVerification: status === true || status === 'true' },
    });
  }

  private detectOs(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS') || userAgent.includes('Macintosh'))
      return 'macOS';
    if (userAgent.includes('Android')) return 'Android';
    if (
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad') ||
      userAgent.includes('iOS')
    )
      return 'iOS';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown Device';
  }

  private detectBrowser(userAgent: string): string {
    if (userAgent.includes('Edg/')) return 'Edge';
    if (userAgent.includes('OPR/') || userAgent.includes('Opera'))
      return 'Opera';
    if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/'))
      return 'Chrome';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/'))
      return 'Safari';
    if (userAgent.includes('Firefox/')) return 'Firefox';
    return 'Browser';
  }

  // // change password
  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    if (!user || !user.password) {
      throw new NotFoundException('User not found');
    }
    if (user.isDeleted) {
      throw new BadRequestException('The account is deleted!');
    }
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashed = await bcrypt.hash(
      dto.newPassword,
      parseInt(process.env.SALT_ROUND!),
    );
    await this.prisma.client.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: 'Password changed successfully' };
  }
  // // refresh token
  async refreshTokens(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.REFRESH_TOKEN_SECRET,
      });

      const user = await this.prisma.client.user.findUnique({
        where: { email: payload.email },
      });
      if (!user) throw new UnauthorizedException('Invalid refresh token');
      // if(!user.isDeleted){
      //  throw new BadRequestException('User is blocked!');
      // }
      return getTokens(
        this.jwtService,
        user.id,
        user.email,
        user.role,
        user.subscribeStatus,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  //update profile
  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
    imageUrl?: string | null,
  ) {
    // Optional: Validate that user exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const data: any = {};

    // Handle string fields
    if (dto.athleteFullName !== undefined)
      data.athleteFullName = dto.athleteFullName;

    // Handle email update — only if it's actually changing
    if (dto.email !== undefined && dto.email !== existingUser.email) {
      const emailTaken = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) {
        throw new BadRequestException(
          'Email is already in use by another account',
        );
      }
      data.email = dto.email;
    }

    if (dto.parentName !== undefined) data.parentName = dto.parentName;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.school !== undefined) data.school = dto.school;
    if (dto.adminTilte !== undefined) data.adminTilte = dto.adminTilte;
    if (dto.sports !== undefined) data.sports = dto.sports;
    if(dto.jerseyNumber !== undefined) data.jerseyNumber = dto.jerseyNumber
    if(dto.dominateHand !== undefined) data.dominateHand = dto.dominateHand

    // Handle numeric fields
    if (dto.gradYear !== undefined) data.gradYear = dto.gradYear;
    if (dto.height !== undefined) data.height = dto.height;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.gpa !== undefined) data.gpa = dto.gpa;

    // Handle stats
    if (dto.ppg !== undefined) data.ppg = dto.ppg;
    if (dto.rpg !== undefined) data.rpg = dto.rpg;
    if (dto.apg !== undefined) data.apg = dto.apg;
    if (dto.spg !== undefined) data.spg = dto.spg;
    if (dto.blk !== undefined) data.blk = dto.blk;

    // Handle boolean

    // Handle FCM token
    if (dto.fcmToken !== undefined) data.fcmToken = dto.fcmToken;

    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
    if (dto.clubTeam !== undefined) data.clubTeam = dto.clubTeam;

    // Handle date of birth (convert string to Date)
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = new Date(dto.dateOfBirth);
    }

    // Handle profile image (only update if provided)
    if (imageUrl) {
      // Delete old image from S3 if it exists
      if (existingUser.imgUrl) {
        try {
          await this.s3Service.deleteFile(existingUser.imgUrl);
        } catch {
          // Log but don't fail the update if old image deletion fails
        }
      }
      data.imgUrl = imageUrl;
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data,
    });

    // Omit sensitive fields like password
    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  // forget and reset password

  async requestResetCode(dto: RequestResetCodeDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted) {
      throw new BadRequestException('The account is deleted!');
    }

    const code = generateOtpCode();
    const hashedCode = await hashOtpCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.client.otpCode.deleteMany({
      where: { email: dto.email },
    });

    await this.prisma.client.otpCode.create({
      data: { email: dto.email, code: hashedCode, expiresAt },
    });

    // const templatePath = path.join(
    //   process.cwd(),
    //   'src',
    //   'module',
    //   'auth',
    //   'mails',
    //   'forget-password.ejs',
    // );

    const templatePath = path.join(__dirname, 'mails', 'forget-password.ejs');

    const html = await ejs.renderFile(templatePath, {
      user: { name: user.athleteFullName },
      resetCode: code,
    });

    await this.emailService.sendEmail({
      to: dto.email,
      subject: 'Highlightz - Reset Password Code',
      html: html,
    });

    return { message: 'Reset code sent successfully' };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    return verifyOtp(this.prisma.client, dto.email, dto.code);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    const verifiedOtp = await this.prisma.client.otpCode.findFirst({
      where: {
        email: dto.email,
        verified: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verifiedOtp || verifiedOtp.expiresAt < new Date()) {
      throw new BadRequestException(
        'OTP verification required before resetting password',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      parseInt(process.env.SALT_ROUND!, 10),
    );

    await this.prisma.client.user.update({
      where: { email: dto.email },
      data: { password: hashedPassword },
    });

    await this.prisma.client.otpCode.deleteMany({
      where: { email: dto.email },
    });

    return { message: 'Password reset successful' };
  }

  async verifyEmailOtp(dto: VerifyResetCodeDto) {
    await verifyOtp(this.prisma.client, dto.email, dto.code);

    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      await this.prisma.client.user.update({
        where: { email: dto.email },
        data: { isActive: true },
      });
    }

    return { message: 'Account verified successfully' };
  }

  async resendOtpCode(dto: RequestResetCodeDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    if (user.isActive) {
      throw new BadRequestException('Account already verified');
    }

    const code = generateOtpCode();
    const hashedCode = await hashOtpCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.client.otpCode.create({
      data: { email: dto.email, code: hashedCode, expiresAt },
    });

    // const templatePath = path.join(
    //   process.cwd(),
    //   'src',
    //   'module',
    //   'auth',
    //   'mails',
    //   'verify-email.ejs',
    // );

    const templatePath = path.join(__dirname, 'mails', 'verify-email.ejs');

    const html = await ejs.renderFile(templatePath, {
      user: { name: user.athleteFullName },
      verificationCode: code,
    });

    await this.emailService.sendEmail({
      to: dto.email,
      subject: 'Highlightz - Verify Your Email',
      html: html,
    });

    return { message: 'Verification code resent' };
  }

  // get current user
  async currentUser(id: string) {
    const existingUser = await this.prisma.client.user.findUnique({
      where: { id: id },
    });

    if (!existingUser) {
      throw new BadRequestException('User not Found');
    }

    return { user: existingUser };
  }

  async getUsers() {
    return this.prisma.client.user.findMany({
      where: {
        isDeleted: false, // exclude soft-deleted users
      },
      select: {
        id: true,
        athleteFullName: true,
        email: true,
        dateOfBirth: true,
        parentName: true,
        city: true,
        bio: true,
        state: true,
        gradYear: true,
        position: true,
        height: true,
        weight: true,
        school: true,
        gpa: true,
        ppg: true,
        rpg: true,
        apg: true,
        spg: true,
        blk: true,
        fcmToken: true,
        agreedToTerms: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        imgUrl: true, // include if you have this field
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPublicUserById(userId: string) {
    console.log('userid', userId);
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      omit: { password: true },
      include: {
        highligts: {
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        },
        posts: true,
        _count: {
          select: {
            highligts: true,
          },
        },
      },
    });

    console.log('user', user);

    if (!user || user.isDeleted || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async recordProfileView(targetUserId: string, currentUserId: string) {
    // 1. Verify the target user exists and is active
    const targetUser = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true, isDeleted: true },
    });

    if (!targetUser || targetUser.isDeleted || !targetUser.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    // 2. Logic: If the viewer is the owner, do not update stats
    if (currentUserId === targetUserId) {
      // Return the user data without modifying the DB
      return { message: 'welcome to yoor profile' };
    }

    // Increment profileViews by 1 and set lastViewed to now
    const updatedUser = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: {
        profileViews: { increment: 1 },
        lastViewed: new Date(),
      },
      omit: { password: true },
    });

    return updatedUser;
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        profileViews: true,
        lastViewed: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const highlightsStats = await this.prisma.client.highlights.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: {
        views: true,
        likes: true,
      },
    });

    return {
      profileViews: user.profileViews,
      lastViewed: user.lastViewed,
      highlights: {
        totalCount: highlightsStats._count.id ?? 0,
        totalViews: highlightsStats._sum.views ?? 0,
        totalLikes: highlightsStats._sum.likes ?? 0,
      },
    };
  }

  async getUserLoginSessions(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.client.loginSession.findMany({
      where: { userId },
      orderBy: { lastActive: 'desc' },
      select: {
        id: true,
        device: true,
        os: true,
        browser: true,
        ipAddress: true,
        city: true,
        region: true,
        country: true,
        isActive: true,
        lastActive: true,
        createdAt: true,
      },
    });
  }

  async sendCustomEmail(dto: {
    email: string;
    subject: string;
    content: string;
    userName?: string;
  }) {
    const templatePath = path.join(__dirname, 'mails', 'custom-email.ejs');
    // console.log('email template ', templatePath)

    const html = await ejs.renderFile(templatePath, {
      content: dto.content,
      userName: dto.userName || 'User',
    });

    return this.emailService.sendEmail({
      to: dto.email,
      subject: dto.subject,
      html: html,
    });
  }
}
