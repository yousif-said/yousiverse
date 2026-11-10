import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "./schema";

// Reuse one connection pool across dev hot reloads instead of leaking a pool per reload.
const globalForDb = globalThis as { postgresClient?: postgres.Sql };
const client = globalForDb.postgresClient ?? postgres(env.DATABASE_URL);
if (process.env.NODE_ENV !== "production") globalForDb.postgresClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Database = typeof db;
