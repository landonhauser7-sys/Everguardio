import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  const steps: { step: string; success: boolean; data?: unknown; error?: string }[] = [];

  try {
    // Step 1: Parse request
    let email: string, password: string;
    try {
      const body = await request.json();
      email = body.email;
      password = body.password;
      steps.push({ step: "parse_request", success: true, data: { email } });
    } catch (e) {
      steps.push({ step: "parse_request", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 400 });
    }

    // Step 2: Test Prisma connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      steps.push({ step: "prisma_connection", success: true });
    } catch (e) {
      steps.push({ step: "prisma_connection", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 3: Find user (same query as auth.ts)
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
      steps.push({
        step: "find_user",
        success: !!user,
        data: user ? { id: user.id, email: user.email, status: user.status } : null
      });
    } catch (e) {
      steps.push({ step: "find_user", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ steps, result: "user_not_found" });
    }

    // Step 4: Check password
    try {
      const isValid = await bcrypt.compare(password, user.password_hash);
      steps.push({ step: "password_check", success: isValid });
    } catch (e) {
      steps.push({ step: "password_check", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 5: Build user object (same as auth.ts returns)
    try {
      const userObject = {
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
      steps.push({ step: "build_user_object", success: true, data: userObject });
    } catch (e) {
      steps.push({ step: "build_user_object", success: false, error: String(e) });
      return NextResponse.json({ steps }, { status: 500 });
    }

    // Step 6: Check environment
    steps.push({
      step: "env_check",
      success: true,
      data: {
        hasSecret: !!process.env.NEXTAUTH_SECRET,
        secretLength: process.env.NEXTAUTH_SECRET?.length,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      },
    });

    return NextResponse.json({ steps, result: "all_steps_passed" });
  } catch (e) {
    steps.push({ step: "unexpected_error", success: false, error: String(e) });
    return NextResponse.json({ steps }, { status: 500 });
  }
}
