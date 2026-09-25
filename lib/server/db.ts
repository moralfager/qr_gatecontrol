import pg from "pg";

const { Pool } = pg;

const DEFAULT_DATABASE_URL = "postgresql://postgres:123@127.0.0.1:5432/gatecontrol";

declare global {
  // eslint-disable-next-line no-var
  var gatecontrolPool: pg.Pool | undefined;
}

export const pool =
  globalThis.gatecontrolPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.gatecontrolPool = pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
