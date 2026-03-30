/* eslint-disable no-prototype-builtins */
// src/admin/admin.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { subscribeStatus, userRole } from '@prisma';
import { GetUsersQueryDto } from './dto/admin.dto';
import { DashboardStatsDto, MonthlyUserStatsDto } from './dto/overView.dto';
import { UserAction } from './dto/action.dto';
import { CreateUserDto, UpdateUserPlanDto } from './dto/create.user.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) { }

  async getUsers(query: GetUsersQueryDto) {
    const { filter, search, page = 1, limit = 10 } = query;

    // Build the search filter (OR condition for multiple fields)
    const searchFilter = search
      ? {
        OR: [
          {
            athleteFullName: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          { email: { contains: search, mode: 'insensitive' as const } },
          { id: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
          { state: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {};

    // Build the role filter
    const roleFilter =
      filter && filter !== 'all' ? { role: filter as userRole } : {};

    const where = {
      ...searchFilter,
      ...roleFilter,
      isDeleted: false,
    };

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          athleteFullName: true,
          email: true,
          role: true,
          subscribeStatus: true,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // admin.service.ts
  async manageUser(
    userId: string,
    action: UserAction = UserAction.DEACTIVATE,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot modify admin users');
    }

    const updateData: any = {};

    if (action === UserAction.DELETE) {
      updateData.isDeleted = true;
    } else if (action === UserAction.DEACTIVATE) {
      updateData.isActive = false;
    } else if (action === UserAction.ACTIVATE) {
      updateData.isActive = true;
    }

    updateData.updatedAt = new Date();

    await this.prisma.client.user.update({
      where: { id: userId },
      data: updateData,
    });
  }
  // In admin.service.ts
  async getUserDetails(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: {
        id: userId,
        isDeleted: false, // Only return non-deleted users
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // async createUser(createUserDto: CreateUserDto) {
  //     // Map system role to userRole enum
  //     const roleMapping: Record<string, userRole> = {
  //         'ADMIN': userRole.ADMIN,
  //         'USER': userRole.USER,
  //         'ATHLETE': userRole.ATHLATE,
  //     };

  //     // Map subscription plan to subscribeStatus enum
  //     const subscriptionMapping: Record<string, subscribeStatus> = {
  //         'BASIC': subscribeStatus.FREE,
  //         'PRO': subscribeStatus.PRO,
  //         'ELITE': subscribeStatus.ELITE,
  //         'COMPEDED': subscribeStatus.COMPED,
  //     };

  //     const role = roleMapping[createUserDto.systemRole] || userRole.USER;
  //     const subscribeStatuS = subscriptionMapping[createUserDto.subscriptionPlan] || subscribeStatus.FREE;

  //     // Generate temporary password
  //     const tempPassword = this.generateTempPassword();
  //     const hashedPassword = await bcrypt.hash(tempPassword, 10);

  //     // Create user
  //     const user = await this.prisma.client.user.create({
  //         data: {
  //             athleteFullName: createUserDto.athleteFullName,
  //             email: createUserDto.email.toLowerCase(),
  //             password: hashedPassword,
  //             role: role,
  //             subscribeStatus: subscribeStatuS,
  //             agreedToTerms: true,
  //             isActive: true,
  //             isDeleted: false,
  //         },
  //     });

  //     return {
  //         user,
  //         tempPassword,
  //     };
  // }

  private generateTempPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
  //overView

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthStart = new Date(currentYear, now.getMonth(), 1);
    const lastMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
    const lastMonthEnd = currentMonthStart;

    // Get current month counts
    const currentMonthUsers = await this.prisma.client.user.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
        },
        isDeleted: false,
      },
    });

    const currentMonthAthletes = await this.prisma.client.user.count({
      where: {
        role: 'ATHLATE',
        createdAt: {
          gte: currentMonthStart,
        },
        isDeleted: false,
      },
    });

    const currentMonthVideos = await this.prisma.client.highlights.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
        },
      },
    });

    const currentMonthVews = await this.prisma.client.highlightsView.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
        },
      },
    });

    // Get last month counts
    const lastMonthUsers = await this.prisma.client.user.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lt: lastMonthEnd,
        },
        isDeleted: false,
      },
    });

    const lastMonthAthletes = await this.prisma.client.user.count({
      where: {
        role: 'ATHLATE',
        createdAt: {
          gte: lastMonthStart,
          lt: lastMonthEnd,
        },
        isDeleted: false,
      },
    });

    const lastMonthVideos = await this.prisma.client.highlights.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lt: lastMonthEnd,
        },
      },
    });

    const lastmountviews = await this.prisma.client.highlightsView.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lt: lastMonthEnd,
        },
      },
    });

    // Calculate percentage changes
    const calculatePercentageChange = (
      current: number,
      previous: number,
    ): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    // Get total counts (all time)
    const totalUsers = await this.prisma.client.user.count({
      where: {
        isDeleted: false,
      },
    });

    const totalAthletes = await this.prisma.client.user.count({
      where: {
        role: 'ATHLATE',
        isDeleted: false,
      },
    });

    const totalVideos = await this.prisma.client.highlights.count();
    const totalViews = await this.prisma.client.highlightsView.count();

    // Get current year monthly user stats
    const monthlyData = new Map<number, number>();
    for (let i = 0; i < 12; i++) {
      monthlyData.set(i, 0);
    }

    const usersThisYear = await this.prisma.client.user.findMany({
      where: {
        createdAt: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1),
        },
        isDeleted: false,
      },
      select: {
        createdAt: true,
      },
    });

    usersThisYear.forEach((user) => {
      const month = user.createdAt.getMonth();
      const currentCount = monthlyData.get(month) || 0;
      monthlyData.set(month, currentCount + 1);
    });

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const monthlyStats: MonthlyUserStatsDto[] = Array.from(
      monthlyData.entries(),
    )
      .map(([monthNumber, newUsers]) => ({
        month: monthNames[monthNumber],
        monthNumber: monthNumber + 1,
        newUsers,
      }))
      .sort((a, b) => a.monthNumber - b.monthNumber);

    return {
      totalUsers: {
        count: totalUsers,
        percentageChange: calculatePercentageChange(
          currentMonthUsers,
          lastMonthUsers,
        ),
      },
      activeAthletes: {
        count: totalAthletes,
        percentageChange: calculatePercentageChange(
          currentMonthAthletes,
          lastMonthAthletes,
        ),
      },
      videoUploads: {
        count: totalVideos,
        percentageChange: calculatePercentageChange(
          currentMonthVideos,
          lastMonthVideos,
        ),
      },
      totalviews: {
        count: totalViews,
        percentageChange: calculatePercentageChange(
          currentMonthVews,
          lastmountviews,
        ),
      },

      currentYearStats: {
        year: currentYear,
        totalNewUsers: usersThisYear.length,
        monthlyStats,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    // 1. Check if user already exists
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // 2. Hash the password
    // const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Set defaults for optional enum fields
    const role = dto.systemRole ?? userRole.ATHLATE; // Default role
    const subscribeStatusValue = dto.subscriptionPlan ?? subscribeStatus.FREE; // Default subscription
    const hashedPassword = await bcrypt.hash(
      dto.password,
      parseInt(process.env.SALT_ROUND!, 10),
    );

    // 4. Create the user in database
    const newUser = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        athleteFullName: dto.athleteFullName,
        role: role as userRole,
        subscribeStatus: subscribeStatusValue as subscribeStatus,
      },
    });

    console.log('new user ', newUser);

    if (dto.planId) {
      const plan = await this.prisma.client.plan.findUnique({
        where: { id: dto.planId },
      });

      if (!plan) {
        throw new BadRequestException('Invalid planId');
      }

      // 1️⃣ Create Subscription
      const subscription = await this.prisma.client.subscription.create({
        data: {
          userId: newUser.id,
          planId: plan.id,
          status: 'active',
          stripeSubscriptionId: null, // IMPORTANT: no stripe
          transactionId: 'ADMIN_' + Date.now(),
          startedAt: new Date(),
          endedAt:
            plan.interval === 'year'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // 2️⃣ Update user subscription status
      const subStatus = plan.name === 'Annually' ? 'ELITE' : plan.name === 'Monthly' ? 'PRO' : 'FREE';

      await this.prisma.client.user.update({
        where: { id: newUser.id },
        data: {
          subscribeStatus: subStatus,
        },
      });

      // 3️⃣ (OPTIONAL but recommended) Create $0 transaction
      await this.prisma.client.transaction.create({
        data: {
          userId: newUser.id,
          subscriptionId: subscription.id,
          planId: plan.id,
          transactionId: 'ADMIN_' + Date.now(),
          amount: 0,
          currency: plan.currency,
          status: 'succeeded',
          billingDate: new Date(),
          receiptUrl: null,
        },
      });
    }

    return {
      success: true,
      message: 'User created successfully',
      data: newUser,
    };
  }
  async updateUserSubscriptionPlan(dto: UpdateUserPlanDto) {
    return await this.prisma.client.$transaction(async (tx) => {
      // 1️⃣ Check user
      const user = await tx.user.findUnique({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2️⃣ Check plan
      const plan = await tx.plan.findUnique({
        where: { id: dto.planId },
      });

      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      // 3️⃣ Cancel old active subscription
      const activeSub = await tx.subscription.findFirst({
        where: {
          userId: user.id,
          status: 'active',
        },
        orderBy: { startedAt: 'desc' },
      });

      if (activeSub) {
        await tx.subscription.update({
          where: { id: activeSub.id },
          data: {
            status: 'canceled',
            endedAt: new Date(),
          },
        });
      }

      // 4️⃣ Create new subscription
      const adminTransactionId = 'ADMIN_UPDATE_' + Date.now();

      const newSubscription = await tx.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: 'active',
          stripeSubscriptionId: null,
          transactionId: adminTransactionId,
          startedAt: new Date(),
          endedAt:
            plan.interval === 'year'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // 5️⃣ Update user status
      const subStatus = plan.name === 'Annually' ? 'ELITE' : plan.name === 'Monthly' ? 'PRO' : 'FREE';

      await tx.user.update({
        where: { id: user.id },
        data: {
          subscribeStatus: subStatus,
        },
      });

      // 6️⃣ Create transaction (admin = 0$)
      await tx.transaction.create({
        data: {
          userId: user.id,
          subscriptionId: newSubscription.id,
          planId: plan.id,
          transactionId: adminTransactionId,
          amount: 0,
          currency: plan.currency,
          status: 'succeeded',
          billingDate: new Date(),
        },
      });
      console.log('user', user);
      return {
        success: true,
        message: 'User subscription updated successfully',
        data: newSubscription,
      };
    });
  }

  async getUserById(userId: string) {
    // 1. Fetch user with selected fields (exclude password) + highlight count
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        // Core identity
        id: true,
        email: true,
        athleteFullName: true,
        role: true,
        subscribeStatus: true,
        imgUrl: true,
        createdAt: true,
        updatedAt: true,

        // Personal info
        parentName: true,
        city: true,
        state: true,
        gradYear: true,
        position: true,
        height: true,
        weight: true,
        school: true,
        gpa: true,
        dateOfBirth: true,

        // Stats
        ppg: true,
        rpg: true,
        apg: true,
        spg: true,
        blk: true,
        profileViews: true,
        lastViewed: true,

        // Metadata
        isActive: true,
        isDeleted: true,
        agreedToTerms: true,
        fcmToken: true,
        stripeCustomerId: true,
        adminTilte: true,
        profileLink: true,
        athlateEmail: true,
        referralCode: true,
        referredBy: true,

        _count: {
          select: {
            highligts: true, // Matches your schema field name (typo preserved)
          },
        },
      },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('User not found');
    }

    // 2. Find all users who were referred by THIS user
    // Logic: Match other users' `referredBy` field with THIS user's `referralCode`
    const referredUsers = await this.prisma.client.user.findMany({
      where: {
        referredBy: user.referralCode, // Users who used this user's referral code
        isDeleted: false, // Exclude deleted accounts
      },
      select: {
        id: true,
        athleteFullName: true,
        email: true,
        createdAt: true,
        subscribeStatus: true,
        profileLink: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 3. Transform response to clean format
    const { _count, ...userData } = user as any;

    return {
      success: true,
      data: {
        ...userData,
        // Rename _count to a cleaner field name
        totalHighlights: (_count as any)?.highligts ?? 0,
        // Add referred users list
        referredUsers: {
          count: referredUsers.length,
          list: referredUsers,
        },
      },
    };
  }

  async getSubscriberCounts() {
    // Use Prisma groupBy to get all counts in a SINGLE efficient query
    const statusCounts = await this.prisma.client.user.groupBy({
      by: ['subscribeStatus'],
      where: {
        isDeleted: false, // Exclude soft-deleted users
      },
      _count: {
        subscribeStatus: true,
      },
    });

    // Initialize default counts for all enum values (ensures all keys exist)
    const counts: Record<subscribeStatus, number> = {
      [subscribeStatus.ELITE]: 0,
      [subscribeStatus.PRO]: 0,
      [subscribeStatus.FREE]: 0,
      [subscribeStatus.COMPED]: 0,
    };

    // Populate counts from query results
    statusCounts.forEach((item) => {
      if (item.subscribeStatus && counts.hasOwnProperty(item.subscribeStatus)) {
        counts[item.subscribeStatus] = item._count.subscribeStatus;
      }
    });

    return counts;
  }
}
