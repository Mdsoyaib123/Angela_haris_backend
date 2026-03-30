/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
// src/stripe/stripe.controller.ts
import { Controller, Post, Body, Req, Res, HttpException, HttpStatus, Get, Patch, Param, RawBody, Query, Delete, Header } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateCheckoutSessionDto, CreateProductDto, TransferOrganizationCommissionDto, UpdatePlanDto } from './dto/strpe.dto';
import { Public } from 'src/common/decorators/public.decorators';
import { Roles } from 'src/common/decorators/roles.decorator';
import { userRole } from '@prisma';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) { }

  @Public()
  @Post('product-and-price')
  @ApiOperation({ summary: 'Create a new subscription plan/product sync with Stripe' })
  @ApiResponse({ status: 201, description: 'Plan created and synced with Stripe' })
  @ApiBody({ type: CreateProductDto })
  async createProductAndPrice(@Body() dto: CreateProductDto) {
    try {
      const {
        name,
        description,
        amount,
        currency = 'usd',
        interval = 'month',
        features = [],
        isPopular = false,
      } = dto;

      if (!name || amount <= 0) {
        throw new HttpException(
          'Name and valid amount (in cents) are required',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.stripeService.createSubscriptionProductAndPrice(
        name,
        amount,
        currency,
        interval,
        description,
        features,
        isPopular
      );

      return {
        success: true,
        message: 'Plan created successfully',
        plan: result.plan,
        stripe: {
          productId: result.productId,
          priceId: result.priceId,
        },
      };
    } catch (error) {
      console.error('Error creating plan:', error);
      throw new HttpException(
        error.message || 'Failed to create plan and sync with Stripe',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Create a Stripe checkout session for a subscription' })
  @ApiResponse({ status: 200, description: 'Checkout session URL generated' })
  @ApiBody({ type: CreateCheckoutSessionDto })
  async createCheckoutSession(
    @Req() req: Request,
    @Body() dto: CreateCheckoutSessionDto
  ) {
    const userId = req.user!.id; // From JWTAuthGuard
    const { priceId } = dto;

    const successUrl = `${process.env.BASE_URL}/user-dashboard/subscription-success`;
    const cancelUrl = `${process.env.BASE_URL}/user-dashboard/subscription-cancel`;

    console.log('Creating checkout session:', { userId, priceId });

    const session = await this.stripeService.createCheckoutSession(
      userId,
      priceId,
      successUrl,
      cancelUrl
    );

    return {
      success: true,
      url: session.url,
      message: 'Please check your email for the checkout link to complete your subscription',
    };
  }

  // GET /stripe/plans → returns all plans
  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiResponse({ status: 200, description: 'List of all subscription plans' })
  async findAllPlans() {
    try {
      const plans = await this.stripeService.findAllPlans();
      return {
        success: true,
        data: plans,
      };
    } catch (error) {
      console.error('Error fetching plans:', error);
      throw new HttpException(
        'Failed to fetch plans',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 🔒 Admin-only: get ALL subscriptions
  @Public()
  @Get('get-all-subscription')
  @ApiOperation({ summary: 'Get all subscriptions (Admin)' })
  @ApiResponse({ status: 200, description: 'List of all subscriptions' })
  async getAllSubscriptions(@Req() req: Request) {
    const subscriptions = await this.stripeService.findAllSubscriptions();
    return {
      statusCode: HttpStatus.OK,
      data: subscriptions,
      count: subscriptions.length,
    };
  }

  // PATCH /stripe/plans/:id
  @Public()
  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiBody({ type: UpdatePlanDto })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto
  ) {
    try {
      const updatedPlan = await this.stripeService.updatePlan(id, dto);
      return {
        success: true,
        message: 'Plan updated successfully',
        plan: updatedPlan,
      };
    } catch (error) {
      console.error('Error updating plan:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to update plan',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @RawBody() rawBody: Buffer,
  ) {
    const sig = req.headers['stripe-signature'] as string;

    if (!rawBody) {
      console.error('Webhook error: rawBody is undefined. Ensure main.ts has rawBody: true and correct body parser config.');
      res.status(400).send('Webhook Error: rawBody is missing');
      return;
    }

    try {
      await this.stripeService.handleWebhookEvent(sig, rawBody);
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  @Get('subscriptionDetails/:subscriptionId')
  @ApiOperation({ summary: 'Get subscription details by ID' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  async getUserSubscription(
    @Req() req: Request,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    if (!subscriptionId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'subscriptionId is required',
      };
    }

    const subscription = await this.stripeService.findSubscriptionById(
      subscriptionId,
    );

    if (!subscription) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Subscription not found or access denied',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: subscription,
    };
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Get current user transactions with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of user transactions with pagination metadata' })
  async getUserTransactions(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const userId = req.user!.id;
    const result = await this.stripeService.findTransactionsByUserId(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    return {
      statusCode: HttpStatus.OK,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('me/transactions/export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="my-transactions.csv"')
  @ApiOperation({
    summary: 'Export current user transactions to CSV (No Pagination)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Downloads a CSV file containing all transaction records for the logged-in user.',
  })
  async exportMyTransactionsCSV(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.user!.id;
      const csvData = await this.stripeService.generateUserTransactionCSV(userId);
      return res.send(csvData);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to generate CSV file',
        error: error.message,
      });
    }
  }

  @Get('me/current-plan')
  @ApiOperation({ summary: 'Get current active plan for the logged-in user' })
  @ApiResponse({ status: 200, description: 'User current plan details' })
  async getCurrentPlan(@Req() req: Request) {
    const userId = req.user!.id;
    const plan = await this.stripeService.getUserCurrentPlan(userId);

    if (!plan) {
      return {
        statusCode: HttpStatus.OK,
        message: 'No active subscription found',
        data: null,
      };
    }

    return {
      statusCode: HttpStatus.OK,
      data: plan,
    };
  }

  @Patch('me/subscription/cancel')
  @ApiOperation({ summary: 'Cancel current user active subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  async cancelMySubscription(@Req() req: Request) {
    const userId = req.user!.id;
    const result = await this.stripeService.cancelMySubscription(userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Subscription canceled successfully',
      data: result,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Get('admin/transactions')
  @ApiOperation({ summary: 'Get all transactions with pagination (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of all transactions with pagination metadata' })
  async getAdminTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10'
  ) {
    const result = await this.stripeService.findAllTransactionsPaginated(
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    return {
      statusCode: HttpStatus.OK,
      data: result.data,
      meta: result.meta,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Get('admin/transactions/export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  @ApiOperation({ summary: 'Export ALL transactions to CSV (No Pagination)' })
  @ApiResponse({
    status: 200,
    description: 'Downloads a CSV file containing all transaction records.'
  })
  async exportTransactionsCSV(@Res() res: Response) {
    try {
      // Call the new service method that fetches ALL data
      const csvData = await this.stripeService.generateTransactionCSV();

      // Send the raw CSV string as the response
      return res.send(csvData);
    } catch (error) {
      // Return a standard JSON error if CSV generation fails
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to generate CSV file',
        error: error.message,
      });
    }
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Get('transaction/:transactionId')
  @ApiOperation({ summary: 'Get transaction details by transaction ID (Admin)' })
  @ApiParam({
    name: 'transactionId',
    required: true,
    description: 'Stripe PaymentIntent ID (pi_...)',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  async getTransactionById(
    @Param('transactionId') transactionId: string,
  ) {
    const transaction = await this.stripeService.findTransactionById(transactionId);
    return {
      statusCode: HttpStatus.OK,
      data: transaction,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics for subscriptions' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async AdminSubscriptionStats() {
    const stats = await this.stripeService.AdminSubscriptionStats();
    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete a plan by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Plan ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  async deletePlanById(@Param('id') id: string) {
    const result = await this.stripeService.deletePlanById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Plan deleted successfully',
      data: result,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Delete('transaction/:id')
  @ApiOperation({ summary: 'Delete a transaction by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Transaction ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  async deleteTransactionById(@Param('id') id: string) {
    const result = await this.stripeService.deleteTransactionById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Transaction deleted successfully',
      data: result,
    };
  }

  @Public() // In production, add @UseGuards(AdminGuard)
  @Delete('subscription/:id')
  @ApiOperation({ summary: 'Delete a subscription by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Subscription ID',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Subscription deleted successfully' })
  async deleteSubscriptionById(@Param('id') id: string) {
    const result = await this.stripeService.deleteSubscriptionById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Subscription deleted successfully',
      data: result,
    };
  }

  @Post('admin/organization/:organizationId/transfer-commission')
  @Roles(userRole.ADMIN)
  @ApiOperation({
    summary:
      'Transfer commission from platform account to organization connected account',
  })
  async transferOrganizationCommission(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Body() dto: TransferOrganizationCommissionDto,
  ) {
    const adminId = req.user?.id;
    const result = await this.stripeService.transferOrganizationCommission(
      organizationId,
      dto.amount,
      dto.currency || 'usd',
      adminId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Organization commission transferred successfully',
      data: result,
    };
  }


}
