/**
 * Read-only Prisma client for the admin query endpoint.
 *
 * Connects with DATABASE_READONLY_URL — a SEPARATE Postgres role
 * (`picks4all_readonly`) that has been granted SELECT only, with NO
 * INSERT/UPDATE/DELETE/DDL privileges and a server-side statement_timeout
 * (see docs/guides/ADMIN_QUERY_ENDPOINT.md for the role-setup script).
 *
 * The role is the real write-protection boundary: even if every app-layer
 * guard in adminQueryService were bypassed, the database itself rejects
 * any mutation because the role lacks the grants. This client must NEVER
 * be used for application logic — it exists solely to back the
 * admin-only ad-hoc query tool.
 *
 * Lazily constructed so the backend boots fine when the env var is unset
 * (the endpoint then returns 503 instead of crashing the process).
 */

import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function getReadonlyDb(): PrismaClient | null {
  const url = process.env.DATABASE_READONLY_URL;
  if (!url) return null;
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url } },
      log: ["error"],
    });
  }
  return client;
}

export async function disconnectReadonlyDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
