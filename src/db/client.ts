import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Detect if this is a Neon database connection
    // Neon connection strings typically contain 'neon.tech' or 'neon' in the hostname
    const isNeon = databaseUrl.includes('neon.tech') || databaseUrl.includes('@neon') || 
                   databaseUrl.includes('neon-db') || databaseUrl.includes('neontech');
    
    // Detect production/serverless environments (Vercel, Lambda, etc.)
    const isProduction = 
      process.env.NODE_ENV === 'production' || 
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV === 'production' ||
      !!process.env.VERCEL_URL ||
      !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    // Configure SSL for Neon and other managed database providers
    // Neon requires SSL and uses self-signed certificates, so we need rejectUnauthorized: false
    let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
    
    // Check if SSL is explicitly disabled in connection string
    const sslExplicitlyDisabled = databaseUrl.includes('sslmode=disable');
    
    if (sslExplicitlyDisabled) {
      sslConfig = false;
    } else if (isNeon || isProduction) {
      // Neon and most managed DB providers (Vercel Postgres, Supabase, Railway, etc.)
      // require SSL with rejectUnauthorized: false to handle self-signed certificates
      sslConfig = { rejectUnauthorized: false };
    } else if (process.env.DATABASE_SSL === 'true') {
      // Development: use SSL if explicitly enabled
      sslConfig = { rejectUnauthorized: false };
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

