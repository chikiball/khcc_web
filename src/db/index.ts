import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// We deliberately omit `connectionString` when DATABASE_URL is not set so that
// pg falls back to the standard PG* env vars (PGHOST, PGUSER, PGPASSWORD,
// PGDATABASE, PGPORT). This avoids URL-encoding pitfalls in passwords that
// contain `+`, `/`, `=`, or other characters with special meaning in URIs.
const pool =
  globalThis.__pgPool ??
  new Pool({
    ...(process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {}),
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalThis.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
