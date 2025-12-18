import TelegramBot from 'node-telegram-bot-api';
import { UsersRepository } from '../db/users';
import { withTransaction } from '../db/client';
import { Config } from '../config';
import { logger } from '../utils/logger';

/**
 * Telegram bot service
 * Handles user interactions
 */
export class TelegramBotService {
  private bot: TelegramBot;

  constructor(
    private config: Config,
    private usersRepo: UsersRepository
  ) {
    this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
  }

  /**
   * Handles /start command
   */
  async handleStartCommand(chatId: number, user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<void> {
    try {
      // Register user in database
      await withTransaction(async (client) => {
        await this.usersRepo.upsertUser(client, {
          telegramId: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        });
      });

      const welcomeMessage = `
👋 Welcome to Daily Job Hunt Bot!

I'll send you daily job notifications based on your preferences.

📋 <b>Current Settings:</b>
• Keywords: ${this.config.jobQueryKeywords.join(', ') || 'None'}
• Locations: ${this.config.jobLocations.join(', ') || 'All'}
• Seniority: ${this.config.jobSeniority.join(', ') || 'All'}

You'll receive up to ${this.config.maxNotificationsPerUser} new jobs per day.

🔔 I'll notify you once daily with fresh job opportunities!

Use /help for more information.
      `.trim();

      await this.bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'HTML',
      });

      logger.info(`User registered`, { telegramId: user.id });
    } catch (error) {
      logger.error(`Error handling start command`, error, { chatId, userId: user.id });
      throw error;
    }
  }

  /**
   * Handles /help command
   */
  async handleHelpCommand(chatId: number): Promise<void> {
    const helpMessage = `
📖 <b>Daily Job Hunt Bot - Help</b>

<b>Commands:</b>
/start - Register and start receiving job notifications
/help - Show this help message

<b>How it works:</b>
• I run once per day (at 9:00 AM UTC)
• I fetch jobs from multiple platforms
• I filter jobs based on configured keywords and locations
• I send you only new jobs you haven't seen before
• Maximum ${this.config.maxNotificationsPerUser} jobs per day

<b>Job Sources:</b>
${this.config.enableRemoteOK ? '• RemoteOK' : ''}
${this.config.enableWWR ? '• WeWorkRemotely' : ''}
${this.config.enableWuzzuf ? '• Wuzzuf' : ''}

For questions or support, contact the bot administrator.
    `.trim();

    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'HTML',
    });
  }

  /**
   * Gets the bot instance (for webhook setup)
   */
  getBot(): TelegramBot {
    return this.bot;
  }
}

