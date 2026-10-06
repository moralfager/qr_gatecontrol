import pg from "pg";

const { Pool } = pg;

const DEFAULT_DATABASE_URL = "postgresql://postgres:123@127.0.0.1:5432/gatecontrol";

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return DEFAULT_DATABASE_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var gatecontrolPool: pg.Pool | undefined;
}

function getPool() {
  if (globalThis.gatecontrolPool) return globalThis.gatecontrolPool;
  const pool = new Pool({
    connectionString: connectionString(),
    max: 10,
  });
  if (process.env.NODE_ENV !== "production") {
    globalThis.gatecontrolPool = pool;
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await getPool().connect();
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
