import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { newDb } from 'pg-mem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool: pg.Pool;
let isInMemory = false;

export async function initDatabase(): Promise<pg.Pool> {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && process.env.NODE_ENV === 'production') {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    isInMemory = false;
  } else {
    // Zero-dependency local dev / test database powered by pg-mem
    const memDb = newDb({
      autoCreateForeignKeyIndices: true,
    });

    const pgAdapter = memDb.adapters.createPg();
    pool = new pgAdapter.Pool();
    isInMemory = true;
  }

  // Run initial schema migration
  const migrationPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query(migrationSql);
    } finally {
      client.release();
    }
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
