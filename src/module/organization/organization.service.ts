import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { StripeService } from '../stripe/stripe.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) { }

  private formatOrganizationMoney<T extends Record<string, any>>(
    organization: T | null,
  ): T | null {
    if (!organization) return organization;
    const truncate = (value: any) =>
      typeof value === 'number' ? (Math.trunc(value * 100) / 100).toFixed(2) : value;

    return {
      ...organization,
      commissionRatePercent: truncate(organization.commissionRatePercent),
      totalCommissionEarned: truncate(organization.totalCommissionEarned),
      commissionBalance: truncate(
        organization.totalCommissionEarned -
          organization.totalCommissionEarned * 0.2,
      ),
      totalCommissionPaid: truncate(organization.totalCommissionPaid),
    };
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const existingByCode = await this.prisma.client.organization.findUnique({
      where: { organizationCode: dto.organizationCode },
    });

    if (existingByCode) {
      throw new BadRequestException('Organization code already exists');
    }

    const existingByEmail = await this.prisma.client.organization.findUnique({
      where: { email: dto.email },
    });

    if (existingByEmail) {
      throw new BadRequestException('Organization email already exists');
    }

    const accessUrl =
      process.env.BASE_URL + `/signup?code=${dto.organizationCode}`;
    const organization = await this.prisma.client.organization.create({
      data: {
        organizationCode: dto.organizationCode,
        organizationName: dto.name,
        email: dto.email,
        accessUrl,
        contactPhone: dto.contactPhone,
        website: dto.website,
        country: dto.country,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        bankAccountHolderName: dto.bankAccountHolderName,
        bankName: dto.bankName,
        bankAccountLast4: dto.bankAccountLast4,
        bankRoutingLast4: dto.bankRoutingLast4,
        bankCountry: dto.bankCountry,
        bankCurrency: dto.bankCurrency,
      },
    });

    const connectOnboarding =
      await this.stripeService.createOrganizationConnectOnboardingLink(
        organization.id,
      );

    const updatedOrganization = await this.prisma.client.organization.update({
      where: { id: organization.id },
      data: {
        onBoardingLink: connectOnboarding!.onboardingUrl,
      },
    });

    return {
      organization: this.formatOrganizationMoney(updatedOrganization),
      connectOnboarding,
    };
  }

  async getOrganizations() {
    const organizations = await this.prisma.client.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return organizations.map((organization) =>
      this.formatOrganizationMoney(organization),
    );
  }

  async getOrganizationById(id: string) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const referredUsers = await this.prisma.client.user.findMany({
      where: {
        oranaizaitonCode: organization.organizationCode,
      },
      select: {
        id: true,
        athleteFullName: true,
        email: true,
        imgUrl: true,
        city: true,
        state: true,
        subscribeStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      organization: this.formatOrganizationMoney(organization),
      referredUsers,
    };
  }

  async trackOrganizationAccess(code: string) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { organizationCode: code },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const organizationWithClicks = await this.prisma.client.organization.update(
      {
        where: { id: organization.id },
        data: {
          totalClicks: { increment: 1 },
          lastAccessed: new Date(),
        },
      },
    );

    return this.formatOrganizationMoney(organizationWithClicks);
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    imageUrl?: string,
  ) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updatedOrganization = await this.prisma.client.organization.update({
      where: { id },
      data: {
        organizationName: dto.organizationName,
        contactPhone: dto.contactPhone,
        website: dto.website,
        country: dto.country,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        bankAccountHolderName: dto.bankAccountHolderName,
        bankName: dto.bankName,
        bankAccountLast4: dto.bankAccountLast4,
        bankRoutingLast4: dto.bankRoutingLast4,
        bankCountry: dto.bankCountry,
        bankCurrency: dto.bankCurrency,
        imaageUrl: imageUrl,
      },
    });

    return this.formatOrganizationMoney(updatedOrganization);
  }

  async deleteOrganization(id: string) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const deletedOrganization = await this.prisma.client.organization.delete({
      where: { id },
    });

    return this.formatOrganizationMoney(deletedOrganization);
  }
}
