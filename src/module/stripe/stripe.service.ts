// src/stripe/stripe.service.ts
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Stripe from 'stripe'; // ✅ Correct import
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlanDto } from './dto/strpe.dto';
import { Parser } from 'json2csv';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class StripeService {
  private stripeClient: Stripe;
  private truncateMoney(value: number) {
    return Math.trunc(value * 100) / 100;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables',
      );
    }

    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  async createSubscriptionProductAndPrice(
    productName: string,
    amount: number,
    currency: string = 'usd',
    interval: 'month' | 'year' = 'month',
    description?: string,
    features: string[] = [],
    isPopular = false,
  ) {
    try {
      // 1. Create Product in Stripe
      const product = await this.stripeClient.products.create({
        name: productName,
        description: description || undefined,
        metadata: {
          created_by: 'your-app',
          internal_plan_name: productName,
        },
      });

      // 2. Create Price in Stripe
      const unitAmount = Math.round(amount * 100);

      const price = await this.stripeClient.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency,
        recurring: { interval },
      });

      // 3. Save Plan in Database
      const plan = await this.prisma.client.plan.create({
        data: {
          name: productName,
          description: description || '',
          price: amount,
          currency,
          interval,
          features: features as any, // Prisma Json type accepts array/object
          isPopular,
          stripeProductId: product.id,
          stripePriceId: price.id,
        },
      });

      return {
        productId: product.id,
        priceId: price.id,
        planId: plan.id,
        plan,
      };
    } catch (error) {
      console.error('Error creating product/price/plan:', error);
      throw new Error('Failed to create plan and sync with Stripe');
    }
  }

  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    // 1. Validate that the price exists in our database first
    const plan = await this.prisma.client.plan.findFirst({
      where: { stripePriceId: priceId },
    });

    if (!plan) {
      console.error(
        `Attempted checkout with invalid/unknown priceId: ${priceId}`,
      );
      throw new HttpException(
        'The selected subscription plan is invalid or no longer available.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, athleteFullName: true },
    });

    if (!user?.email) {
      throw new HttpException('User email not found.', HttpStatus.NOT_FOUND);
    }

    const session = await this.stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId, // Pass user ID to link session to user
      subscription_data: {
        metadata: {
          userId, // Also pass in subscription metadata to be safer
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      // Metadata can be useful for debugging
      metadata: {
        userId,
        planId: plan.id,
      },
    });

    return session;
  }

  async createOrganizationConnectOnboardingLink(organizationId: string) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    let stripeAccountId = organization.stripeAccountId;

    if (!stripeAccountId) {
      const account = await this.stripeClient.accounts.create({
        type: 'express',
        country: organization.country || 'US',
        email: organization.email,
        business_type: 'company',
        business_profile: {
          name: organization.organizationName,
          url: organization.website || undefined,
        },
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          organizationId: organization.id,
          organizationCode: organization.organizationCode,
          organizationName: organization.organizationName,
          bankHolder: organization.bankAccountHolderName || '',
          bankName: organization.bankName || '',
          bankLast4: organization.bankAccountLast4 || '',
        },
      });

      stripeAccountId = account.id;

      await this.prisma.client.organization.update({
        where: { id: organization.id },
        data: {
          stripeAccountId,
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
          stripeOnboardingCompleted: account.details_submitted,
        },
      });
    }

    const refreshUrl =
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      `${process.env.BASE_URL}/organization/connect/refresh`;
    const returnUrl =
      process.env.STRIPE_CONNECT_RETURN_URL ||
      `${process.env.BASE_URL}/organization/connect/return`;

    const accountLink = await this.stripeClient.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return {
      organizationId: organization.id,
      stripeAccountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    };
  }

  async transferOrganizationCommission(
    organizationId: string,
    amount: number,
    currency: string = 'usd',
    adminId?: string,
  ) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        organizationName: true,
        stripeAccountId: true,
        commissionBalance: true,
      },
    });

    if (!organization) {
      throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
    }

    if (!organization.stripeAccountId) {
      throw new HttpException(
        'Organization stripeAccountId is not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (amount <= 0) {
      throw new HttpException(
        'Transfer amount must be greater than 0',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (amount > organization.commissionBalance) {
      throw new HttpException(
        'Transfer amount cannot exceed organization commission balance',
        HttpStatus.BAD_REQUEST,
      );
    }

    const amountInCents = Math.round(amount * 100);
    if (amountInCents <= 0) {
      throw new HttpException(
        'Transfer amount is too small',
        HttpStatus.BAD_REQUEST,
      );
    }

    const destinationAccount = await this.stripeClient.accounts.retrieve(
      organization.stripeAccountId,
    );

    const transfersCapability = destinationAccount.capabilities?.transfers;
    const canReceiveTransfer =
      transfersCapability === 'active' &&
      destinationAccount.details_submitted &&
      destinationAccount.payouts_enabled;

    if (!canReceiveTransfer) {
      const refreshUrl =
        process.env.STRIPE_CONNECT_REFRESH_URL ||
        `${process.env.BASE_URL}/organization/connect/refresh`;
      const returnUrl =
        process.env.STRIPE_CONNECT_RETURN_URL ||
        `${process.env.BASE_URL}/organization/connect/return`;

      const accountLink = await this.stripeClient.accountLinks.create({
        account: organization.stripeAccountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      await this.prisma.client.organization.update({
        where: { id: organization.id },
        data: {
          stripeOnboardingCompleted: destinationAccount.details_submitted,
          stripeChargesEnabled: destinationAccount.charges_enabled,
          stripePayoutsEnabled: destinationAccount.payouts_enabled,
        },
      });

      throw new HttpException(
        {
          message:
            'Organization Stripe account is not ready to receive transfers. Complete onboarding and required capabilities first.',
          data: {
            organizationId: organization.id,
            stripeAccountId: organization.stripeAccountId,
            transfersCapability,
            detailsSubmitted: destinationAccount.details_submitted,
            payoutsEnabled: destinationAccount.payouts_enabled,
            chargesEnabled: destinationAccount.charges_enabled,
            onboardingUrl: accountLink.url,
            onboardingUrlExpiresAt: accountLink.expires_at,
          },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let transfer: Stripe.Transfer;
    try {
      transfer = await this.stripeClient.transfers.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        destination: organization.stripeAccountId,
        metadata: {
          organizationId: organization.id,
          organizationName: organization.organizationName,
          adminId: adminId || '',
        },
      });
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.code === 'insufficient_capabilities_for_transfer'
      ) {
        throw new HttpException(
          'Connected account cannot receive transfers yet. Please complete Stripe onboarding and enable transfer capability.',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }

    await this.prisma.client.organization.update({
      where: { id: organization.id },
      data: {
        commissionBalance: { decrement: amount },
        totalCommissionPaid: { increment: amount },
      },
    });

    return {
      transferId: transfer.id,
      destination: transfer.destination,
      amount,
      currency: transfer.currency,
    };
  }
  // GET all plans
  async findAllPlans() {
    return this.prisma.client.plan.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
  // UPDATE plan
  async updatePlan(id: string, updateData: UpdatePlanDto) {
    // 1. Find existing plan
    const existingPlan = await this.prisma.client.plan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }

    // 2. Check if price or currency changed
    const priceChanged =
      (updateData.price !== undefined &&
        updateData.price !== existingPlan.price) ||
      (updateData.currency !== undefined &&
        updateData.currency !== existingPlan.currency);

    let newStripePriceId = existingPlan.stripePriceId;

    // 3. If price/currency changed → create new Stripe Price
    if (priceChanged) {
      if (!existingPlan.stripeProductId) {
        throw new Error('Cannot update price: missing stripeProductId');
      }

      const unitAmount = Math.round(
        (updateData.price ?? existingPlan.price) * 100,
      );

      const newPrice = await this.stripeClient.prices.create({
        product: existingPlan.stripeProductId,
        unit_amount: unitAmount,
        currency: updateData.currency ?? existingPlan.currency,
        recurring: {
          interval: existingPlan.interval as 'month' | 'year',
        },
      });

      // Optional: Archive old price (good practice)
      if (existingPlan.stripePriceId) {
        await this.stripeClient.prices.update(existingPlan.stripePriceId, {
          active: false,
        });
      }

      newStripePriceId = newPrice.id;
    }

    // 4. Update DB record
    const updatedPlan = await this.prisma.client.plan.update({
      where: { id },
      data: {
        name: updateData.name,
        description: updateData.description,
        price: updateData.price,
        currency: updateData.currency,
        features: updateData.features as any, // Prisma Json
        isPopular: updateData.isPopular,
        stripePriceId: newStripePriceId, // update only if changed
        updatedAt: new Date(),
      },
    });

    return updatedPlan;
  }

  async handleWebhookEvent(signature: string, payload: Buffer) {
    let event: Stripe.Event;

    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error(
          'STRIPE_WEBHOOK_SECRET is not defined in environment variables',
        );
      }

      event = this.stripeClient.webhooks.constructEvent(
        payload.toString(),
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`🔔 Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as any);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const userId = session.client_reference_id;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    const transactionId = session.payment_intent as string;

    console.log('sessin', session);
    if (!userId) {
      console.warn('No client_reference_id in session:', session.id);
      return;
    }

    console.log(
      `✅ Checkout completed for user: ${userId}, Stripe Customer: ${customerId}`,
    );

    // 🔥 1. CRITICAL: Link user to Stripe Customer ID immediately
    // This ensures future webhooks (like invoice.payment_succeeded) can find this user
    // even if the rest of this handler fails.
    try {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: customerId,
        },
      });
      console.log(`🔗 User ${userId} linked to Stripe customer ${customerId}`);
    } catch (err) {
      console.error(
        `Failed to link user ${userId} to customer ${customerId}:`,
        err.message,
      );
      // We continue anyway to try and process the subscription
    }

    // 2. Fetch the session with line_items expanded
    const fullSession = await this.stripeClient.checkout.sessions.retrieve(
      session.id,
      {
        expand: ['line_items'], // ← critical!
      },
    );

    const priceId = fullSession.line_items?.data[0]?.price?.id;
    if (!priceId) {
      console.error(`Price ID not found in session ${session.id}`);
      return;
    }

    console.log(
      `✅ Processing checkout for user: ${userId}, priceId: ${priceId}`,
    );
    const plan = await this.prisma.client.plan.findFirst({
      where: { stripePriceId: priceId },
    });

    if (!plan) {
      console.error(
        `❌ Plan not found in database for Stripe Price ID: ${priceId}. Please ensure your database plans match Stripe.`,
      );
      return;
    }

    const subStatus = plan.interval === 'year' ? 'ELITE' : 'PRO';

    // 3. Update User Status
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        subscribeStatus: subStatus,
      },
    });

    // 4. Create or Update Subscription record (Idempotent)
    try {
      if (!subscriptionId) {
        console.error(`Subscription ID missing in session ${session.id}`);
        return;
      }

      const existingSubscription =
        await this.prisma.client.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });

      await this.prisma.client.subscription.upsert({
        where: { stripeSubscriptionId: subscriptionId },
        update: {
          status: 'active',
          planId: plan.id,
          transactionId: transactionId || session.id,
        },
        create: {
          userId,
          transactionId: transactionId || session.id,
          planId: plan.id,
          status: 'active',
          stripeSubscriptionId: subscriptionId,
          startedAt: new Date(),
        },
      });

      if (!existingSubscription) {
        const subscribedUser = await this.prisma.client.user.findUnique({
          where: { id: userId },
          select: { athleteFullName: true, email: true },
        });

        const subscriberName =
          subscribedUser?.athleteFullName || subscribedUser?.email || 'A user';

        await this.notificationService.notifyAdminsSubscriptionSuccess({
          subscriberId: userId,
          subscriberName,
          planName: plan.name,
        });
      }

      console.log(
        `📝 Subscription ${subscriptionId} synced during checkout for user ${userId} (Plan: ${plan.name})`,
      );
    } catch (err) {
      console.error(
        `Error saving subscription for user ${userId}:`,
        err.message,
      );
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: any) {
    console.log('invoice', invoice);
    console.log(
      `Processing invoice.payment_succeeded for customer: ${invoice.customer}`,
    );
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;
    const paymentIntentId = invoice.payment_intent as string;
    const amountPaid = invoice.amount_paid;
    const currency = invoice.currency;
    const receiptUrl = invoice.hosted_invoice_url || invoice.receipt_url;
    const exprieAt = invoice.period_end; //1771490924
    console.log('invoice', invoice);
    // Use PaymentIntent ID if available, otherwise fallback to Invoice ID to ensure a unique transaction record
    const transactionId = paymentIntentId || invoice.id;

    if (!transactionId) {
      console.error(
        'No valid transaction identifier (PaymentIntent or Invoice ID) found for invoice:',
        invoice.id,
      );
      return;
    }

    let user = await this.prisma.client.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(
        `User not found for Stripe customer: ${customerId}. Checking via subscription lookup...`,
      );
      // FALLBACK: Lookup by stripeSubscriptionId if customer lookup fails (race condition)
      const sub = await this.prisma.client.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        include: { user: true },
      });

      if (sub?.user) {
        user = sub.user;
        console.log(
          `🔗 Recovery: Found user ${user.id} via subscription ${subscriptionId}`,
        );

        // Link them now for future invoices
        // if (!user.stripeCustomerId) {
        //   await this.prisma.client.user.update({
        //     where: { id: user.id },
        //     data: { stripeCustomerId: customerId }
        //   });
        // }
      }
    }

    if (!user) {
      console.error(
        `❌ CRITICAL: User not found for Stripe customer ${customerId} or subscription ${subscriptionId}. Cannot create transaction.`,
      );
      return;
    }

    // 2. Find subscription with plan details (Search by Subscription ID first)
    let subscription: any = null;
    if (subscriptionId) {
      subscription = await this.prisma.client.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { plan: true },
      });
    }

    // Fallback: search by customer if subscription ID retrieval is weird (rare)
    if (!subscription && user) {
      subscription = await this.prisma.client.subscription.findFirst({
        where: { userId: user.id },
        include: { plan: true },
        orderBy: { startedAt: 'desc' },
      });
    }

    const subStatus = subscription?.plan?.interval === 'year' ? 'ELITE' : 'PRO';

    // 1. Update user fields
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        subscribeStatus: subStatus,
      },
    });

    const existingTransaction = await this.prisma.client.transaction.findUnique(
      {
        where: { transactionId: transactionId },
        select: { status: true },
      },
    );

    // 3. Create or Update Transaction record
    await this.prisma.client.transaction.upsert({
      where: { transactionId: transactionId },
      update: {
        status: 'succeeded',
        receiptUrl,
        amount: amountPaid / 100,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        subscriptionId: subscription?.id,
        planId: subscription?.planId, // 🌟 Capture the current plan for this transaction specifically
        transactionId: transactionId,
        amount: amountPaid / 100,
        currency,
        status: 'succeeded',
        receiptUrl,
        billingDate: new Date(),
      },
    });

    const shouldCreditOrganization =
      !existingTransaction || existingTransaction.status !== 'succeeded';

    console.log('shouldcr', shouldCreditOrganization);
    if (shouldCreditOrganization && user.oranaizaitonCode) {
      const referralOrganization =
        await this.prisma.client.organization.findUnique({
          where: { organizationCode: user.oranaizaitonCode },
          select: { id: true, commissionRatePercent: true },
        });

      console.log('referralOrganization:', referralOrganization);
      if (referralOrganization) {
        const commissionPercent =
          referralOrganization.commissionRatePercent ?? 20;
        const commissionAmount = this.truncateMoney(
          (amountPaid / 100) * (commissionPercent / 100),
        );

        await this.prisma.client.organization.update({
          where: { id: referralOrganization.id },
          data: {
            totalCommissionEarned: { increment: commissionAmount },
            commissionBalance: { increment: commissionAmount },
            subscriptionPaymentCount: { increment: 1 },
            lastCommissionAt: new Date(),
          },
        });
      }
    }

    if (subscription?.id) {
      await this.prisma.client.subscription.update({
        where: { id: subscription.id },
        data: {
          endedAt: new Date(exprieAt * 1000),
        },
      });
    }

    console.log(
      `💰 Payment succeeded for user ${user.id}: ${amountPaid} ${currency} (Tx: ${transactionId})`,
    );
  }

  private async handleInvoicePaymentFailed(invoice: any) {
    const customerId = invoice.customer as string;
    const paymentIntentId = invoice.payment_intent as string;
    const transactionId = paymentIntentId || invoice.id;

    if (!transactionId) return;

    const user = await this.prisma.client.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    // Record failed transaction attempt
    await this.prisma.client.transaction.upsert({
      where: { transactionId: transactionId },
      update: { status: 'failed' },
      create: {
        userId: user.id,
        transactionId: transactionId,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        billingDate: new Date(),
      },
    });

    // Update user status to FREE on payment failure
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { subscribeStatus: 'FREE' },
    });

    console.log(`❌ Payment failed for user ${user.id} (Tx: ${transactionId})`);
  }

  private async handleSubscriptionEvent(subscription: Stripe.Subscription) {
    const stripeSubscriptionId = subscription.id;
    const status = subscription.status; // 'active', 'canceled', 'past_due', etc.
    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      console.warn('No price ID in subscription:', stripeSubscriptionId);
      return;
    }

    // Find your internal Plan
    const plan = await this.prisma.client.plan.findFirst({
      where: { stripePriceId: priceId },
    });

    if (!plan) {
      console.warn('Plan not found for price:', priceId);
      return;
    }

    // Find existing subscription in your DB
    const dbSub = await this.prisma.client.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    const statusMap: Record<string, string> = {
      active: 'active',
      trialing: 'active',
      past_due: 'past_due',
      unpaid: 'canceled',
      canceled: 'canceled',
      incomplete: 'canceled',
      incomplete_expired: 'canceled',
    };

    const mappedStatus = statusMap[status] || 'canceled';

    if (dbSub) {
      // Update existing
      await this.prisma.client.subscription.update({
        where: { id: dbSub.id },
        data: {
          status: mappedStatus,
          planId: plan.id, // 🌟 Update plan pointer just in case it was changed via Dashboard
          endedAt: status === 'canceled' ? new Date() : null,
        },
      });

      // Update user's subscription status based on current status
      if (mappedStatus === 'canceled') {
        await this.prisma.client.user.update({
          where: { id: dbSub.userId },
          data: { subscribeStatus: 'FREE' },
        });
      } else if (mappedStatus === 'active') {
        const subStatus = plan.interval === 'year' ? 'ELITE' : 'PRO';
        await this.prisma.client.user.update({
          where: { id: dbSub.userId },
          data: { subscribeStatus: subStatus },
        });
      }
    } else {
      // Rare: subscription created outside checkout (e.g., via dashboard)
      // OR: subscription record doesn't exist yet because the checkout event is slower

      // Double check if it exists now (to avoid race conditions within this method if called twice)
      const customerId = subscription.customer as string;
      const user = await this.prisma.client.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // One final check to see if handleCheckoutSessionCompleted finished just now
        const reCheck = await this.prisma.client.subscription.findFirst({
          where: { stripeSubscriptionId },
        });

        if (!reCheck) {
          await this.prisma.client.subscription.upsert({
            where: { stripeSubscriptionId: stripeSubscriptionId },
            update: {
              status: mappedStatus,
              planId: plan.id,
              endedAt: status === 'canceled' ? new Date() : null,
            },
            create: {
              transactionId: '',
              userId: user.id,
              planId: plan.id,
              status: mappedStatus,
              stripeSubscriptionId,
              startedAt: new Date(subscription.start_date * 1000),
              endedAt: status === 'canceled' ? new Date() : null,
            },
          });
          console.log(
            `📝 Subscription ${stripeSubscriptionId} synced from event: ${status}`,
          );
        } else {
          // It was created by someone else in the last few ms, so just update it
          await this.prisma.client.subscription.update({
            where: { id: reCheck.id },
            data: {
              status: mappedStatus,
              endedAt: status === 'canceled' ? new Date() : null,
            },
          });
        }
      }
    }

    console.log(
      `🔄 Subscription ${stripeSubscriptionId} updated to: ${mappedStatus}`,
    );
  }

  async findAllSubscriptions() {
    return this.prisma.client.subscription.findMany({
      include: {
        plan: true,
        transactions: true,
        user: {
          select: {
            id: true,
            email: true,
            athleteFullName: true,
          },
        },
      },
    });
  }

  // Optional: Get subscriptions for current user
  async findSubscriptionById(subscriptionId: string) {
    return this.prisma.client.subscription.findFirst({
      where: {
        id: subscriptionId,
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            athleteFullName: true,
          },
        },
      },
    });
  }

  async findTransactionById(transactionId: string) {
    const transaction = await this.prisma.client.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            athleteFullName: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            stripeSubscriptionId: true,
            startedAt: true,
            endedAt: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    }

    return transaction;
  }

  async findTransactionsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.client.transaction.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              athleteFullName: true,
              email: true,
            },
          },
          plan: true, // 🌟 Direct link
          subscription: {
            include: {
              plan: true,
            },
          },
        },
        orderBy: { billingDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.transaction.count({
        where: { userId },
      }),
    ]);

    return {
      data: transactions.map((tx) => {
        // Use plan directly from transaction if available, otherwise fallback to subscription's plan
        const plan = tx.subscription?.plan;
        return {
          username: tx.user?.athleteFullName || tx.user?.email || 'Unknown',
          transactionId: tx.transactionId,
          interval: plan?.name || 'N/A', // 🌟 Much more accurate now!
          amount: tx.amount,
          status: tx.status === 'succeeded' ? 'Successfull' : tx.status,
          billingDate: tx.billingDate,
          receiptUrl: tx.receiptUrl,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async AdminSubscriptionStats() {
    const [freeCount, proCount, eliteCount, compedCount] = await Promise.all([
      this.prisma.client.user.count({ where: { subscribeStatus: 'FREE' } }),
      this.prisma.client.user.count({ where: { subscribeStatus: 'PRO' } }),
      this.prisma.client.user.count({ where: { subscribeStatus: 'ELITE' } }),
      this.prisma.client.user.count({ where: { subscribeStatus: 'COMPED' } }),
    ]);

    const recentTransactions = await this.prisma.client.transaction.findMany({
      take: 10,
      orderBy: { billingDate: 'desc' },
      include: {
        user: {
          select: {
            athleteFullName: true,
          },
        },
        plan: true, // 🌟 Direct link
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    return {
      stats: {
        free: freeCount,
        pro: proCount,
        elite: eliteCount,
        comped: compedCount,
      },
      transactions: recentTransactions.map((tx) => {
        const plan = tx.plan || tx.subscription?.plan;
        return {
          id: tx.id,
          transactionId: tx.transactionId,
          customer: tx.user?.athleteFullName || 'Unknown',
          plan: plan?.name || 'N/A', // 🌟 Accurate plan name
          amount: tx.amount.toFixed(2), // Convert cents to dollars
          status: tx.status === 'succeeded' ? 'Successfull' : tx.status,
          billingDate: tx.billingDate,
          recieptUrl: tx.receiptUrl,
        };
      }),
    };
  }
  async findAllTransactionsPaginated(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.client.transaction.findMany({
        include: {
          user: {
            select: {
              athleteFullName: true,
              email: true,
            },
          },
          plan: true, // 🌟 Direct link to the plan paid for
          subscription: {
            include: {
              plan: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { billingDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.transaction.count(),
    ]);

    return {
      data: transactions.map((tx) => {
        const plan = tx.plan || tx.subscription?.plan;
        return {
          id: tx.id,
          transactionId: tx.transactionId,
          user: tx.user?.athleteFullName || tx.user?.email || 'Unknown',
          plan: plan?.name || 'N/A', // 🌟 Accurate plan name
          amount: tx.amount.toFixed(2),
          currency: tx.currency,
          status: tx.status === 'succeeded' ? 'Successfull' : tx.status,
          billingDate: tx.billingDate,
          receiptUrl: tx.receiptUrl,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async generateTransactionCSV() {
    // 1. Fetch ALL transactions (No pagination/skip)
    // We use the same 'include' structure to ensure data availability
    const allTransactions = await this.prisma.client.transaction.findMany({
      include: {
        user: { select: { athleteFullName: true, email: true } },
        plan: true,
        subscription: { include: { plan: { select: { name: true } } } },
      },
      orderBy: { billingDate: 'desc' },
    });

    // 2. Map using the same helper function
    const formattedData = allTransactions.map((tx) =>
      this.mapTransactionData(tx),
    );

    // 3. Define the order of columns in the CSV file
    const fields = [
      'id',
      'transactionId',
      'user',
      'email',
      'plan',
      'amount',
      'currency',
      'status',
      'billingDate',
      'receiptUrl',
    ];

    const parser = new Parser({ fields });
    return parser.parse(formattedData);
  }

  async generateUserTransactionCSV(userId: string) {
    const userTransactions = await this.prisma.client.transaction.findMany({
      where: { userId },
      include: {
        user: { select: { athleteFullName: true, email: true } },
        plan: true,
        subscription: { include: { plan: { select: { name: true } } } },
      },
      orderBy: { billingDate: 'desc' },
    });

    const formattedData = userTransactions.map((tx) =>
      this.mapTransactionData(tx),
    );

    const fields = [
      'id',
      'transactionId',
      'user',
      'email',
      'plan',
      'amount',
      'currency',
      'status',
      'billingDate',
      'receiptUrl',
    ];

    const parser = new Parser({ fields });
    return parser.parse(formattedData);
  }

  async getUserCurrentPlan(userId: string) {
    const subscription = await this.prisma.client.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        plan: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!subscription) {
      return null;
    }

    return {
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      startedAt: subscription.startedAt,
      endedAt: subscription.endedAt,
      plan: subscription.plan,
    };
  }

  async cancelMySubscription(userId: string) {
    const activeSubscription = await this.prisma.client.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!activeSubscription) {
      throw new HttpException(
        'No active subscription found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (activeSubscription.stripeSubscriptionId) {
      await this.stripeClient.subscriptions.cancel(
        activeSubscription.stripeSubscriptionId,
      );
    }

    const updatedSubscription = await this.prisma.client.subscription.update({
      where: { id: activeSubscription.id },
      data: {
        status: 'canceled',
        endedAt: new Date(),
      },
    });

    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        subscribeStatus: 'FREE',
      },
    });

    return updatedSubscription;
  }

  async deletePlanById(id: string) {
    const existingPlan = await this.prisma.client.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: { id: true },
          take: 1,
        },
        transactions: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!existingPlan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }

    if (
      existingPlan.subscriptions.length > 0 ||
      existingPlan.transactions.length > 0
    ) {
      throw new HttpException(
        'Plan cannot be deleted because it is linked to subscriptions or transactions',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (existingPlan.stripePriceId) {
      await this.stripeClient.prices.update(existingPlan.stripePriceId, {
        active: false,
      });
    }

    if (existingPlan.stripeProductId) {
      await this.stripeClient.products.update(existingPlan.stripeProductId, {
        active: false,
      });
    }

    const deletedPlan = await this.prisma.client.plan.delete({
      where: { id },
    });

    return deletedPlan;
  }

  async deleteTransactionById(id: string) {
    const existingTransaction = await this.prisma.client.transaction.findUnique(
      {
        where: { id },
      },
    );

    if (!existingTransaction) {
      throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    }

    const deletedTransaction = await this.prisma.client.transaction.delete({
      where: { id },
    });

    return deletedTransaction;
  }

  async deleteSubscriptionById(id: string) {
    const existingSubscription =
      await this.prisma.client.subscription.findUnique({
        where: { id },
        include: {
          transactions: {
            select: { id: true },
            take: 1,
          },
        },
      });

    if (!existingSubscription) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }

    if (existingSubscription.transactions.length > 0) {
      throw new HttpException(
        'Subscription cannot be deleted because it is linked to transactions',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (existingSubscription.stripeSubscriptionId) {
      await this.stripeClient.subscriptions.cancel(
        existingSubscription.stripeSubscriptionId,
      );
    }

    const deletedSubscription = await this.prisma.client.subscription.delete({
      where: { id },
    });

    return deletedSubscription;
  }

  private mapTransactionData(tx: any) {
    const plan = tx.plan || tx.subscription?.plan;
    return {
      id: tx.id,
      transactionId: tx.transactionId,
      user: tx.user?.athleteFullName || tx.user?.email || 'Unknown',
      email: tx.user?.email || 'N/A', // Added email explicitly for CSV utility
      plan: plan?.name || 'N/A',
      amount: tx.amount.toFixed(2),
      currency: tx.currency,
      status: tx.status === 'succeeded' ? 'Successfull' : tx.status,
      billingDate: tx.billingDate
        ? new Date(tx.billingDate).toISOString().split('T')[0]
        : 'N/A', // Format date for CSV
      receiptUrl: tx.receiptUrl || 'N/A',
    };
  }
}
