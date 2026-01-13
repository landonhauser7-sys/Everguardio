import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getPrismaClient() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Remove channel_binding parameter - it causes issues with the pg driver
  connectionString = connectionString.replace(/[&?]channel_binding=require/g, '');

  // Clean up any double && or trailing ? that might result
  connectionString = connectionString.replace(/&&/g, '&').replace(/\?&/g, '?').replace(/\?$/, '');

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      max: 1,
            ssl: {
                      rejectUnauthorized: false,
            },
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
