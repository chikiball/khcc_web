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
      user: process.env.PGUSER ?? "khcc",
      password: process.env.PGPASSWORD ?? "khcc",
      database: process.env.PGDATABASE ?? "khcc",
    };

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials,
  verbose: true,
  strict: true,
});
