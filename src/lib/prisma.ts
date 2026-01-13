import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Global type declaration for caching in serverless
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Remove channel_binding parameter and ensure SSL for Neon
  let cleanedUrl = connectionString.replace(/&?channel_binding=require/g, '');

  // Ensure sslmode is set for Neon database
  if (!cleanedUrl.includes('sslmode=')) {
    cleanedUrl += cleanedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }

  // Reuse existing pool if available (serverless optimization)
  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString: cleanedUrl,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Use singleton pattern for serverless environments
const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
