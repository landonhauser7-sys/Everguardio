import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";
import { hkdf } from "@panva/hkdf";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Derive encryption key exactly like NextAuth does
async function getDerivedEncryptionKey(secret: string) {
  return await hkdf(
    "sha256",
    secret,
    "",
    "NextAuth.js Generated Encryption Key",
    32
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Find user
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

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create token payload matching NextAuth format
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload = {
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
      iat: now,
      exp: now + maxAge,
    };

    // Derive encryption key exactly like NextAuth
    const encryptionKey = await getDerivedEncryptionKey(process.env.NEXTAUTH_SECRET!);

    // Create encrypted JWT using jose (same as NextAuth)
    const token = await new jose.EncryptJWT(tokenPayload)
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt(now)
      .setExpirationTime(now + maxAge)
      .setJti(crypto.randomUUID())
      .encrypt(encryptionKey);

    // Set cookie using Next.js cookies API
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    cookieStore.set(cookieName, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: maxAge,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
