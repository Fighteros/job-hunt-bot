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
    const isProduction = 
      process.env.NODE_ENV === 'production' || 
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV === 'production' ||
      // Check if running on Vercel by looking for Vercel-specific env vars
      !!process.env.VERCEL_URL;
    
    // Parse connection string to check if SSL is required
    let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
    
    try {
      const url = new URL(databaseUrl);
      const sslMode = url.searchParams.get('sslmode');
      
      // If connection string explicitly disables SSL, respect that
      if (sslMode === 'disable') {
        sslConfig = false;
      } else if (isProduction) {
        // In production, always use SSL with rejectUnauthorized: false for self-signed certs
        // This is necessary for managed database providers like Vercel Postgres, Neon, etc.
        sslConfig = { rejectUnauthorized: false };
      } else if (process.env.DATABASE_SSL === 'true' || sslMode === 'require' || sslMode === 'prefer') {
        // In development, use SSL if explicitly enabled or if connection string requires it
        sslConfig = { rejectUnauthorized: false };
      }
    } catch (e) {
      // If URL parsing fails, fall back to simple logic
      if (isProduction) {
        sslConfig = { rejectUnauthorized: false };
      } else if (process.env.DATABASE_SSL === 'true') {
        sslConfig = { rejectUnauthorized: false };
      }
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

