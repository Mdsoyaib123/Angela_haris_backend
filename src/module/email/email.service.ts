import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: {
    filename: string;
    path?: string;
    content?: Buffer;
    cid?: string; // optional (for inline images)
  }[];
};

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM');

    if (!host || !port || !user || !pass) {
      throw new Error('SMTP configuration is missing. Check SMTP_* env vars.');
    }

    this.defaultFrom = from || user;

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendEmail(input: SendEmailInput) {
    const { to, subject, text, html, from } = input;

    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error('Email recipient "to" is missing');
    }
    console.log('EMAIL TO:', to);

    return this.transporter.sendMail({
      from: from || this.defaultFrom,
      to,
      subject,
      text,
      html,
      attachments: input.attachments,
    });
  }
}
