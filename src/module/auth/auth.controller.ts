/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { S3Service } from '../s3/s3.service';
import { LoginDto } from './dto/login.dto';
import { Public } from 'src/common/decorators/public.decorators';
import { type Request, type Response } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import sendResponse from 'src/utils/sendResponse';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { userRole } from '@prisma';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateUserDto } from './dto/update-account.dto';
import {
  RequestResetCodeDto,
  ResetPasswordDto,
  VerifyResetCodeDto,
} from './dto/forgetPasswordDto';
import { SendEmailDto } from './dto/send-email.dto';
import {
  UpdateTwoStepVerificationStatusDto,
  VerifyTwoStepVerificationDto,
} from './dto/UpdateTwoStepVerificationStatusDto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private s3Service: S3Service,
  ) {}

  // refresh token
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh JWT tokens',
    description: 'Refreshes the access token using the provided refresh token.',
  })
  @ApiBody({
    description: 'Refresh token for refreshing access token',
    type: RefreshTokenDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully.',
  })
  async refreshToken(
    @Body('refreshToken') token: string,
    @Res() res: Response,
  ) {
    const result = await this.authService.refreshTokens(token);
    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Token refreshed',
      data: result,
    });
  }

  @Public()
  @UseInterceptors(FileInterceptor('image'))
  @Post('register')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Register a user with optional profile image upload',
    type: RegisterDto,
  })
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    let imageUrl: string | null = null;

    if (file) {
      try {
        imageUrl = await this.s3Service.uploadFile(file, 'profile-images');
      } catch (error) {
        console.error(error, 'File Upload Error');
        return sendResponse(res, {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          success: false,
          message: 'Image upload failed. Please try again.',
          data: null,
        });
      }
    }

    const result = await this.authService.register(dto, imageUrl);

    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Registration successful',
      data: result,
    });
  }

  // login
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.authService.login(dto, req, res);
    res.cookie('accessToken', result.access_token, {
      httpOnly: false, // Prevents client-side access to the cookie
      secure: false, // Only true for HTTPS
      maxAge: 86400000, // 1 day expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: false,
      secure: false, // Only true for HTTPS
      maxAge: 604800000, // 7 days expiration
      sameSite: 'none', // Allow cross-origin requests to send the cookie
    });
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Login successful',
      data: result,
    });
  }

  @Post('update-two-step-verification-status')
  async updateTwoStepVerificationStatus(
    @Body() dto: UpdateTwoStepVerificationStatusDto,
    @Res() res: Response,
  ) {
    console.log('dto', dto);
    const result = await this.authService.updateTwoStepVerificationStatus(
      dto.userId,
      dto.isTwoStepVerification,
    );
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Two step verification status updated',
      data: result,
    });
  }

  @Public()
  @Post('verify-two-step-verification')
  async verifyTwoStepVerification(
    @Body() dto: VerifyTwoStepVerificationDto,
    @Res() res: Response,
  ) {
    console.log('verify code controller dto', dto);
    const result = await this.authService.verifyTwoStepVerification(
      dto.userId,
      dto.code,
    );

    if (result.access_token) {
      res.cookie('accessToken', result.access_token, {
        httpOnly: false,
        secure: false,
        maxAge: 86400000,
        sameSite: 'none',
      });
    }

    if (result.refresh_token) {
      res.cookie('refreshToken', result.refresh_token, {
        httpOnly: false,
        secure: false,
        maxAge: 604800000,
        sameSite: 'none',
      });
    }

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Two step verification successful',
      data: result,
    });
  }

  // change password
  @Patch('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.authService.changePassword(req.user!.id, dto);
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Password changed',
      data: result,
    });
  }

  // @Put('activate-account')
  // @Roles(userRole.ADMIN)
  // async active_account(
  //   @Body() dto: AccountActiveDto,
  //   @Res() res: Response,
  //   @Req() req: Request,
  // ) {
  //   const result = await this.authService.active_account(dto);

  //   return sendResponse(res, {
  //     statusCode: HttpStatus.OK,
  //     success: true,
  //     message: 'Account activated successfully',
  //     data: result,
  //   });
  // }

  @UseInterceptors(FileInterceptor('image'))
  @Patch('update-profile')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Update user profile with optional image upload',
    type: UpdateUserDto,
  })
  @ApiOperation({ summary: 'Update user profile (with optional image)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  async updateProfile(
    @Req() req: any,
    @Body() updateDto: UpdateUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    let imageUrl: string | null = null;

    if (file) {
      try {
        imageUrl = await this.s3Service.uploadFile(file, 'profile-images');
      } catch (error) {
        console.error(error, 'File Upload Error');
        return sendResponse(res, {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          success: false,
          message: 'Image upload failed. Please try again.',
          data: null,
        });
      }
    }

    const updatedUser = await this.authService.updateProfile(
      userId,
      updateDto,
      imageUrl,
    );

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: RequestResetCodeDto, @Res() res: Response) {
    const result = await this.authService.requestResetCode(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Reset Code sent successfully',
      data: result,
    });
  }

  @Public()
  @Post('forget-reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Res() res: Response) {
    const result = await this.authService.resetPassword(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Reset Password successful',
      data: result,
    });
  }

  @Public()
  @Post('verify-otp')
  async verifyOtpCode(@Body() dto: VerifyResetCodeDto, @Res() res: Response) {
    const result = await this.authService.verifyResetCode(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'OTP verified successfully',
      data: result,
    });
  }

  @Public()
  @Post('resend-otp')
  async resendOtp(@Body() dto: RequestResetCodeDto, @Res() res: Response) {
    const result = await this.authService.resendOtpCode(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'OTP resent successfully',
      data: result,
    });
  }

  @Get('me')
  @ApiOperation({
    summary: 'Check if a user is active',
    description: 'Returns  the user account ',
  })
  async currentUser(@Req() req: Request, @Res() res: Response) {
    const userId = req.user!.id;
    const result = await this.authService.currentUser(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User profile retrieved',
      data: result,
    });
  }

  @Get('allUsers')
  async getUsers(@Res() res: Response) {
    const result = await this.authService.getUsers();
    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User profile retrieved',
      data: result,
    });
  }

  @Public()
  @Get('user/:id')
  async getPublicUserById(@Param('id') id: string, @Res() res: Response) {
    const result = await this.authService.getPublicUserById(id);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User profile retrieved',
      data: result,
    });
  }

  @Patch('profile-view/:id')
  async trackProfileView(@Param('id') targetId: string, @Req() req: Request) {
    // Ensure your JWT strategy attaches the user object to req.user
    const currentUserId = req.user!.id;
    return this.authService.recordProfileView(targetId, currentUserId);
  }

  @Get('me/stats')
  async getMyStats(@Req() req: Request) {
    const userId = req.user?.id;

    if (!userId) {
      throw new NotFoundException('User ID not found in token');
    }

    return this.authService.getUserStats(userId);
  }

  @Get('login-sessions')
  async getUserLoginSessions(@Req() req: Request, @Res() res: Response) {
    const userId = req.user!.id;

    if (!userId) {
      throw new NotFoundException('User ID not found in token');
    }

    const result = await this.authService.getUserLoginSessions(userId);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User login sessions retrieved successfully',
      data: result,
    });
  }

  @Public()
  @Post('send-mail')
  @ApiOperation({ summary: 'Send a custom email' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email sent successfully',
  })
  async sendCustomEmail(@Body() dto: SendEmailDto, @Res() res: Response) {
    await this.authService.sendCustomEmail(dto);

    return sendResponse(res, {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Email sent successfully',
      data: null,
    });
  }
}
