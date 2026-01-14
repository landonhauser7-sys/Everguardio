import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import * as jose from "jose";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const steps: { step: string; success: boolean; error?: string; data?: unknown }[] = [];

  try {
    // Step 1: Parse body
    const body = await request.json().catch(() => null);
    steps.push({ step: "parse_body", success: !!body, data: body ? "parsed" : "failed" });
    if (!body) {
      return NextResponse.json({ steps, error: "Invalid body" }, { status: 400 });
    }

    const { email, password } = body;

    // Step 2: Find user
    let user;
    try {
      user = await prisma.users.findUnique({
        where: { email },
        include: {
          teams_users_team_idToteams: {
            select: { id: true, name: true },
          },
        },
      });
      steps.push({ step: "find_user", success: !!user, data: user ? user.email : "not found" });
    } catch (e) {
      steps.push({ step: "find_user", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ steps, error: "User not found" }, { status: 401 });
    }

    // Step 3: Check password
    try {
      const isValid = await bcrypt.compare(password, user.password_hash);
      steps.push({ step: "check_password", success: isValid });
      if (!isValid) {
        return NextResponse.json({ steps, error: "Invalid password" }, { status: 401 });
      }
    } catch (e) {
      steps.push({ step: "check_password", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 4: Create session data
    const sessionUser = {
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
    };
    steps.push({ step: "create_session_data", success: true });

    // Step 5: Get secret
    const secret = process.env.NEXTAUTH_SECRET;
    steps.push({ step: "get_secret", success: !!secret, data: secret ? "exists" : "missing" });
    if (!secret) {
      return NextResponse.json({ steps, error: "Secret missing" }, { status: 500 });
    }

    // Step 6: Create signing key
    let signingKey;
    try {
      signingKey = new TextEncoder().encode(secret);
      steps.push({ step: "create_signing_key", success: true, data: `length: ${signingKey.length}` });
    } catch (e) {
      steps.push({ step: "create_signing_key", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 7: Create JWT
    let token;
    try {
      const now = Math.floor(Date.now() / 1000);
      token = await new jose.SignJWT({
        ...sessionUser,
        iat: now,
        exp: now + 30 * 24 * 60 * 60,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now)
        .setExpirationTime(now + 30 * 24 * 60 * 60)
        .sign(signingKey);
      steps.push({ step: "create_jwt", success: true, data: `token length: ${token.length}` });
    } catch (e) {
      steps.push({ step: "create_jwt", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 8: Create response
    const response = NextResponse.json({
      success: true,
      steps,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
      },
    });

    // Step 9: Set cookie
    try {
      const isProduction = process.env.NODE_ENV === "production";
      const cookieName = isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token";
      response.cookies.set(cookieName, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    } catch (e) {
      // Cookie setting shouldn't fail, but log anyway
      console.error("Cookie set error:", e);
    }

    return response;
  } catch (error) {
    steps.push({ step: "unexpected_error", success: false, error: String(error) });
    return NextResponse.json({ steps, error: "Unexpected error" }, { status: 500 });
  }
}
