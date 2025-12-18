import TelegramBot from 'node-telegram-bot-api';
import { JobWithHash } from '../types/job';
import { User } from '../types/user';
import { NotificationsRepository } from '../db/notifications';
import { withTransaction } from '../db/client';
import { Config } from '../config';
import { logger } from '../utils/logger';

/**
 * Dispatches job notifications to users via Telegram
 * Ensures idempotent delivery
 */
export class NotificationDispatcher {
  private bot: TelegramBot;

  constructor(
    private config: Config,
    private notificationsRepo: NotificationsRepository
  ) {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
  }

  /**
   * Sends job notifications to a user
   * Returns number of successfully sent notifications
   */
  async sendNotificationsToUser(
    user: User,
    jobs: JobWithHash[]
  ): Promise<number> {
    if (jobs.length === 0) {
      return 0;
    }

    // Apply per-user limit
    const limitedJobs = jobs.slice(0, this.config.maxNotificationsPerUser);
    let sentCount = 0;

    try {
      await withTransaction(async (client) => {
        for (const job of limitedJobs) {
          try {
            // Mark as sent first (idempotent)
            const wasNew = await this.notificationsRepo.markAsSent(
              client,
              user.telegramId,
              job.hash
            );

            if (!wasNew) {
              logger.debug(`Notification already sent, skipping`, {
                userId: user.telegramId,
                jobHash: job.hash,
              });
              continue;
            }

            // Send notification
            await this.sendJobNotification(user.telegramId, job);
            sentCount++;

            logger.debug(`Notification sent`, {
              userId: user.telegramId,
              jobHash: job.hash,
            });
          } catch (error) {
            logger.error(`Failed to send notification`, error, {
              userId: user.telegramId,
              jobHash: job.hash,
            });
            // Continue with other jobs - partial failures are acceptable
          }
        }
      });

      logger.info(`Sent ${sentCount} notifications to user ${user.telegramId}`);
      return sentCount;
    } catch (error) {
      logger.error(`Error sending notifications to user`, error, {
        userId: user.telegramId,
      });
      throw error;
    }
  }

  /**
   * Formats and sends a single job notification
   */
  private async sendJobNotification(
    chatId: number,
    job: JobWithHash
  ): Promise<void> {
    const message = this.formatJobMessage(job);
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  }

  /**
   * Formats a job as a Telegram message
   */
  private formatJobMessage(job: JobWithHash): string {
    const lines = [
      `🔍 <b>${this.escapeHtml(job.title)}</b>`,
      `🏢 ${this.escapeHtml(job.company)}`,
      `📍 ${this.escapeHtml(job.location)}`,
      `🌐 ${this.escapeHtml(job.platform)}`,
    ];

    if (job.seniority) {
      lines.push(`👤 ${this.escapeHtml(job.seniority)}`);
    }

    if (job.techStack && job.techStack.length > 0) {
      lines.push(`💻 ${this.escapeHtml(job.techStack.join(', '))}`);
    }

    lines.push(`\n🔗 <a href="${job.url}">View Job</a>`);

    return lines.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

