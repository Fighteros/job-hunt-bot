import { PoolClient } from 'pg';
import { User } from '../types/user';
import { logger } from '../utils/logger';

/**
 * Database operations for users
 */
export class UsersRepository {
  /**
   * Creates or updates a user
   */
  async upsertUser(client: PoolClient, user: User): Promise<void> {
    try {
      await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (telegram_id) 
         DO UPDATE SET
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           updated_at = NOW()`,
        [user.telegramId, user.username || null, user.firstName || null, user.lastName || null]
      );
    } catch (error) {
      logger.error(`Error upserting user`, error, { telegramId: user.telegramId });
      throw error;
    }
  }

  /**
   * Gets all active users
   */
  async getAllUsers(client: PoolClient): Promise<User[]> {
    const result = await client.query(
      `SELECT telegram_id, username, first_name, last_name
       FROM users
       ORDER BY created_at DESC`
    );

    return result.rows.map(row => ({
      telegramId: row.telegram_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
    }));
  }
}

