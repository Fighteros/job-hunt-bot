import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from '../../src/config';
import { TelegramBotService } from '../../src/services/telegram-bot';
import { UsersRepository } from '../../src/db/users';
import { logger } from '../../src/utils/logger';

/**
 * Telegram webhook endpoint
 * Handles incoming messages from Telegram
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const config = loadConfig();
    const usersRepo = new UsersRepository();
    const botService = new TelegramBotService(config, usersRepo);

    const update = req.body;

    // Verify webhook secret (optional but recommended)
    if (config.telegram.webhookSecret) {
      const secret = req.headers['x-telegram-bot-api-secret-token'];
      if (secret !== config.telegram.webhookSecret) {
        logger.warn('Invalid webhook secret');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    // Handle message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const user = message.from;

      if (!user) {
        res.status(400).json({ error: 'Invalid message' });
        return;
      }

      if (text === '/start') {
        await botService.handleStartCommand(chatId, user);
      } else if (text === '/help') {
        await botService.handleHelpCommand(chatId);
      } else {
        // Unknown command - send help
        await botService.handleHelpCommand(chatId);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Error handling Telegram webhook', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

