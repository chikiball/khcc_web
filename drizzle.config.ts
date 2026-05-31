import { defineConfig } from "drizzle-kit";

// Prefer individual PG* env vars in production (Docker) — the connection-URL
// form is fragile because passwords with `+`, `/`, `=` get URL-decoded
// differently than they're stored as the postgres role password. DATABASE_URL
// is still supported for local non-Docker dev where the password is simple.
const dbCredentials = process.env.DATABASE_URL
  ? { url: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER ?? "burkam",
      password: process.env.PGPASSWORD ?? "burkam",
      database: process.env.PGDATABASE ?? "burkam",
      // Self-hosted Postgres in Docker doesn't serve TLS. drizzle-kit
      // defaults `ssl` to true when discrete fields are used, so set it
      // explicitly here.
      ssl: false,
    };

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials,
  verbose: true,
  strict: true,
});
