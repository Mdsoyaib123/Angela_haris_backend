import { Module } from '@nestjs/common';
import { SendRoadMapAndOrganizationNameController } from './controllers/send-road-map-and-organization-name.controller';
import { SendRoadMapAndOrganizationNameService } from './services/send-road-map-and-organization-name.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule], // ✅ THIS FIXES YOUR ERROR
  controllers: [SendRoadMapAndOrganizationNameController],
  providers: [SendRoadMapAndOrganizationNameService],
})
export class SendRoadMapAndOrganizationNameModule {}
