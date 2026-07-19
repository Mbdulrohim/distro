import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | undefined;

/**
 * Server-only Neon client. The connection is created lazily so `next build`
 * can analyse routes without opening a database connection.
 */
export function db(): NeonQueryFunction<false, false> {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  client = neon(connectionString);
  return client;
}
