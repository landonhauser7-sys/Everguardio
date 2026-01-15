import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check database connection and user data
    const users = await prisma.users.findMany({
      select: {
        email: true,
        role: true,
        commission_level: true,
      },
      orderBy: { commission_level: "desc" },
      take: 10,
    });

    const dbUrl = process.env.DATABASE_URL;
    const hasDbUrl = !!dbUrl;
    const dbHost = dbUrl ? new URL(dbUrl).host : "NOT SET";

    return NextResponse.json({
      status: "connected",
      database_host: dbHost,
      has_database_url: hasDbUrl,
      user_count: users.length,
      users: users,
      env: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      has_database_url: !!process.env.DATABASE_URL,
    });
  }
}
