import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neon } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  // Remove channel_binding parameter - it causes issues
  connectionString = connectionString.replace(/[&?]channel_binding=require/g, '');
  connectionString = connectionString.replace(/&&/g, '&').replace(/\?&/g, '?').replace(/\?$/, '');

  // Use Neon's HTTP-based serverless driver
  const sql = neon(connectionString);

  // Cast to any to work around type mismatch between package versions
  const adapter = new PrismaNeon(sql as any);

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
