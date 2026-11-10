import { recreateTestDatabase } from "@yousiverse/db/testing";

export default async function setup() {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error("DATABASE_URL is not set.");
  await recreateTestDatabase(testUrl);
}
