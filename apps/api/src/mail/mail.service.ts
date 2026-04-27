import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { type AppConfigService } from '../config/config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: AppConfigService) {
    this.from = config.get('SMTP_FROM');
    this.frontendUrl = config.get('FRONTEND_URL');
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST'),
      port: config.get('SMTP_PORT'),
      auth: config.get('SMTP_USER')
        ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') }
        : undefined,
    });
  }

  async sendPasswordResetMail(to: string, rawToken: string): Promise<void> {
    const url = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Passwort zurücksetzen — sellline',
        text: `Dein Link zum Zurücksetzen des Passworts (gültig 1 Stunde):\n\n${url}\n\nFalls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.`,
        html: `<p>Dein Link zum Zurücksetzen des Passworts (gültig 1 Stunde):</p><p><a href="${url}">${url}</a></p><p>Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>`,
      });
    } catch (err) {
      this.logger.warn(`[MAIL] Password-reset mail failed for ${to}: ${String(err)}`);
      this.logger.log(`[PASSWORD_RESET] token=${rawToken} url=${url}`);
    }
  }

  async sendWelcomeMail(to: string, name: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Willkommen bei sellline',
        text: `Hallo ${name},\n\nDein Account wurde erfolgreich erstellt. Du kannst dich jetzt unter ${this.frontendUrl}/login anmelden.`,
      });
    } catch (err) {
      this.logger.warn(`[MAIL] Welcome mail failed for ${to}: ${String(err)}`);
    }
  }
}
