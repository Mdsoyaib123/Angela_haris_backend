import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EmailService } from 'src/module/email/email.service';
import * as path from 'path';
import * as fs from 'fs';
import { ContactDto } from '../dto/sendRoadMapDto';

const filePath = path.join(process.cwd(), 'public', 'roadmap.jpg');
console.log('filepath', filePath);

@Injectable()
export class SendRoadMapAndOrganizationNameService {
  constructor(private readonly emailService: EmailService) { }
  async sendRoadmap(email: string) {
    try {
      const filePath = path.join(process.cwd(), 'public', 'roadmap.jpg');

      console.log('File exists:', fs.existsSync(filePath));

      await this.emailService.sendEmail({
        to: email,
        subject: 'Your Athlete Recruiting Roadmap',
        html: `
        <h2>Your Roadmap is Ready 🚀</h2>
        <p>Please find your roadmap attached below.</p>
          <img 
      src="https://i.postimg.cc/YqVyTCBP/roadmap.jpg" 
      alt="Roadmap"
      style="width:100%; max-width:600px; border-radius:8px;"
    />
      `,
      });

      return {
        success: true,
        message: 'Roadmap sent successfully',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to send roadmap');
    }
  }
  async sendOrganizationName(dto: {
    organizationName: string;
    Organizationemail: string;
  }) {
    const ownerEmail = 'Ops@highlightzapp.com';

    try {
      await this.emailService.sendEmail({
        to: ownerEmail,
        subject: '🏢 New Organization Application',
        html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background: #0ea5e9; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Organization Application</h2>
            <p style="margin: 5px 0 0; font-size: 14px;">
              A new organization has applied
            </p>
          </div>

          <!-- Body -->
          <div style="padding: 20px;">
            
            <h3 style="margin-top: 0; color: #333;">Organization Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; font-weight: bold;">Organization Name:</td>
                <td style="padding: 10px;">${dto.organizationName}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 10px; font-weight: bold;">Email:</td>
                <td style="padding: 10px;">${dto.Organizationemail}</td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="margin-top: 25px; text-align: center;">
              <a href="mailto:${dto.Organizationemail}" 
                 style="background: #0ea5e9; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                 Reply to Organization
              </a>
            </div>

          </div>

          <!-- Footer -->
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #888;">
            <p style="margin: 0;">This request was submitted via your platform</p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} Highlightz App</p>
          </div>

        </div>
      </div>
      `,
      });

      return {
        success: true,
        message: 'Organization Application sent successfully',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to send roadmap');
    }
  }

  async sendContactMessage(dto: ContactDto) {
    const ownerEmail = 'Ops@highlightzapp.com';

    try {
      await this.emailService.sendEmail({
        to: ownerEmail,
        subject: `📩 New Contact: ${dto.subject}`,
        html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background: #4f46e5; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">New Contact Message</h2>
            <p style="margin: 5px 0 0; font-size: 14px;">You've received a new inquiry</p>
          </div>

          <!-- Body -->
          <div style="padding: 20px;">
            
            <h3 style="margin-top: 0; color: #333;">User Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Name:</td>
                <td style="padding: 8px;">${dto.firstName} ${dto.lastName}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Email:</td>
                <td style="padding: 8px;">${dto.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Phone:</td>
                <td style="padding: 8px;">${dto.phoneNumber || 'N/A'}</td>
              </tr>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Role:</td>
                <td style="padding: 8px;">${dto.role}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Subject:</td>
                <td style="padding: 8px;">${dto.subject}</td>
              </tr>
            </table>

            <!-- Message Box -->
            <div style="margin-top: 20px;">
              <h3 style="color: #333;">Message</h3>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5;">
                <p style="margin: 0; color: #555; line-height: 1.6;">
                  ${dto.message}
                </p>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #888;">
            <p style="margin: 0;">This message was sent from your website contact form</p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} Highlightz App</p>
          </div>

        </div>
      </div>
      `,
      });

      return {
        success: true,
        message: 'Message sent successfully',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to send message');
    }
  }
}
