import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_hash: true,
        first_name: true,
        last_name: true,
        status: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found", email }, { status: 404 });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);

    return NextResponse.json({
      found: true,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      status: user.status,
      role: user.role,
      passwordValid: isValid,
      hashPrefix: user.password_hash.substring(0, 30),
    });
  } catch (error) {
    console.error("Test auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
