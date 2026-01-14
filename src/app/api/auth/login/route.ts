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
      include: {
        teams_users_team_idToteams: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Account not active" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create session token (simple signed format)
    const sessionData = {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      teamId: user.team_id,
      teamName: user.teams_users_team_idToteams?.name || null,
      profilePhotoUrl: user.profile_photo_url,
      commissionLevel: user.commission_level,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    // Simple HMAC-like signature using the secret
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
    const payload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
    const signature = Buffer.from(secret + payload).toString("base64url").slice(0, 43);
    const token = `${payload}.${signature}`;

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
