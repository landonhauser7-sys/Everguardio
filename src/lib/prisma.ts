import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Remove channel_binding parameter as it can cause issues
  const cleanedUrl = connectionString.replace(/&?channel_binding=require/g, '');

  const pool = new Pool({
    connectionString: cleanedUrl,
    max: 1, // Limit pool size to ensure fresh connections
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Don't cache in development to avoid stale connection issues
const prisma = createPrismaClient();

export default prisma;
