import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from 'src/module/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { userRole } from '@prisma';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  constructor(private prisma: PrismaService) {}

  private readonly logger = new Logger(SeederService.name);

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const superAdminEmail = process.env.ADMIN_EMAIL as string;
    const superAdminPassword = process.env.ADMIN_PASSWORD as string;
    const supperAdmin = await this.prisma.client.user.findFirst({
      where: { role: userRole.ADMIN },
    });

    if (supperAdmin) {
      this.logger.log('Admin is already exists, skipping seeding.');
      return;
    }

    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    const superAdminFullName = process.env.ADMIN_FULL_NAME as string;
    const superAdminDOB = process.env.ADMIN_DOB as string;

    await this.prisma.client.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        role: userRole.ADMIN,
        isActive: true,
        athleteFullName: superAdminFullName,
        dateOfBirth: new Date(superAdminDOB),
      },
    });

    this.logger.log(`Default super admin created: ${superAdminEmail}`);
  }
}
