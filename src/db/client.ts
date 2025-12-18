import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Determine SSL configuration
    // For production environments (Vercel, etc.), always use SSL with rejectUnauthorized: false
    // to handle self-signed certificates from managed database providers
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const sslConfig = isProduction 
      ? { rejectUnauthorized: false }
      : process.env.DATABASE_SSL === 'true' 
        ? { rejectUnauthorized: false }
        : false;

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pool;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
  });
}

