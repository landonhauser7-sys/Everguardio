import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Simple base64 encoded session (not secure, just for testing)
    const sessionData = JSON.stringify({
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    const token = Buffer.from(sessionData).toString("base64");

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
      },
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(
      isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      token,
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
