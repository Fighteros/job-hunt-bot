import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Detect production/serverless environments
    // In production: ALWAYS force SSL (no exceptions, no parsing, no guessing)
    const isProduction = 
      process.env.NODE_ENV === 'production' || 
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV === 'production' ||
      !!process.env.VERCEL_URL ||
      !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    // SSL configuration: deterministic and safe
    // Production/serverless: ALWAYS use SSL (managed DBs require it)
    // Development: use SSL by default, allow explicit override via DATABASE_SSL=false
    let sslConfig: boolean | { rejectUnauthorized: boolean };
    
    if (isProduction) {
      // Production: force SSL always (no exceptions)
      sslConfig = { rejectUnauthorized: false };
    } else {
      // Development: default to SSL, allow explicit disable
      const sslDisabled = process.env.DATABASE_SSL === 'false';
      sslConfig = sslDisabled ? false : { rejectUnauthorized: false };
    }

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

