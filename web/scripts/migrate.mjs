import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Vercel injects DATABASE_URL directly. For local runs, load the same env
// files Next.js developers commonly use without overriding an exported value.
for (const file of [".env.local", ".env", "../.env.local", "../.env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

neonConfig.webSocketConstructor = ws;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, "../../database/migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const appliedResult = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.name));

  // A Neon project populated with Neon's Supabase import tool already has the
  // complete application schema. Baseline that import instead of trying to
  // recreate its tables; later migrations still run normally.
  const initialMigration = files[0];
  if (initialMigration && !applied.has(initialMigration)) {
    const existingSchema = await client.query(`
      SELECT to_regclass('public.users') IS NOT NULL
         AND to_regclass('public.distributions') IS NOT NULL
         AND to_regclass('public.distribution_transactions') IS NOT NULL
         AND to_regclass('public.recipients') IS NOT NULL
         AND to_regclass('public.templates') IS NOT NULL AS complete
    `);
    if (existingSchema.rows[0]?.complete) {
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [initialMigration]);
      applied.add(initialMigration);
      console.log(`Baselined existing schema as ${initialMigration}`);
    }
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
