import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function testDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `${url.pathname}_test`;
  return url.href;
}

/** Drops and recreates the database at `testUrl`, then applies all migrations. */
export async function recreateTestDatabase(testUrl: string): Promise<void> {
  const name = new URL(testUrl).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to recreate "${name}": test database names must end in _test.`);
  }

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.href, { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  await admin.end();

  const client = postgres(testUrl, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder });
  await client.end();
}
