import pg from 'pg';
import { newDb } from 'pg-mem';
import { INITIAL_SCHEMA_SQL } from './schema.js';

let pool: pg.Pool;
let isInMemory = false;

export async function initDatabase(): Promise<pg.Pool> {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (process.env.NODE_ENV === 'production' || databaseUrl.startsWith('postgres'))) {
    console.log('[GCC Connect DB] Connecting to PostgreSQL database...');
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

    pool = new pg.Pool({
      connectionString: databaseUrl,
      // Cloud databases like Neon, Supabase, Render require SSL with self-signed certificate acceptance
      ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
    });
    isInMemory = false;
  } else {
    console.log('[GCC Connect DB] Using in-memory zero-dependency database (pg-mem)...');
    const memDb = newDb({
      autoCreateForeignKeyIndices: true,
    });

    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();
    isInMemory = true;
  }

  // Execute embedded initial schema DDL
  const client = await pool.connect();
  try {
    console.log('[GCC Connect DB] Running database migrations...');
    await client.query(INITIAL_SCHEMA_SQL);
    console.log('[GCC Connect DB] Database schema migration completed successfully.');
  } catch (err: any) {
    console.error('[GCC Connect DB] Error applying database schema:', err.message);
    throw err;
  } finally {
    client.release();
  }

  return pool;
}

export async function getPool(): Promise<pg.Pool> {
  if (!pool) {
    return initDatabase();
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = await getPool();
  const res = await p.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const p = await getPool();
  await p.query(sql, params);
}

export async function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
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

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    // @ts-expect-error Reset reference
    pool = undefined;
  }
}
