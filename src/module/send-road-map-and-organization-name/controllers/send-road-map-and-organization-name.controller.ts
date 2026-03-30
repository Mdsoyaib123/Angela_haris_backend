/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Body, Controller, Post } from '@nestjs/common';

import { ContactDto, SendOrganizationNameDto, SendRoadmapDto } from '../dto/sendRoadMapDto';
import { SendRoadMapAndOrganizationNameService } from '../services/send-road-map-and-organization-name.service';
import { Public } from 'src/common/decorators/public.decorators';

@Controller('send-road-map-and-organization-name')
export class SendRoadMapAndOrganizationNameController {
  constructor(
    private readonly service: SendRoadMapAndOrganizationNameService,
  ) {}

  @Public()
  @Post('send-roadmap')
  async sendRoadmap(@Body() dto: SendRoadmapDto) {
    return this.service.sendRoadmap(dto.email);
  }

  @Public()
  @Post('send-organization-name')
  async sendOrganizationName(@Body() dto: SendOrganizationNameDto) {
    return this.service.sendOrganizationName(dto as any);
  }
  @Public()
  @Post('send-contact-message')
  async sendContactMessage(@Body() dto: ContactDto) {
    return this.service.sendContactMessage(dto as any);
  }
}
