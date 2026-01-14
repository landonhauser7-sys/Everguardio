import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, password, role, commissionLevel, managerId, agencyOwnerId } = await request.json();

    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email,
        first_name: firstName,
        last_name: lastName,
        password_hash: hashedPassword,
        role: role || "AGENT",
        status: "ACTIVE",
        commission_level: commissionLevel || 70,
        manager_id: managerId || null,
        agency_owner_id: agencyOwnerId || null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        commission_level: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
