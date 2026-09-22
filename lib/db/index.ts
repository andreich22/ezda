import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const client = postgres(connectionString, {
  max: 1,
  prepare: false,
  ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? false
    : "require",
});

export const db = drizzle(client);

