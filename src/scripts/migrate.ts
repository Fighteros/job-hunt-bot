import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from '../db/client';
import { logger } from '../utils/logger';

/**
 * Database migration script
 * Runs the schema.sql file to set up the database
 */
async function migrate() {
  try {
    logger.info('Starting database migration...');

    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    const pool = getPool();
    await pool.query(schema);

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', error);
    process.exit(1);
  }
}

migrate();

