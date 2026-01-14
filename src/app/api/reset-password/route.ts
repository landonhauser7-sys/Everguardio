import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// POST - Reset password for a user
export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and newPassword required" },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the user's password
    const user = await prisma.users.update({
      where: { email },
      data: { password_hash: hashedPassword },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset for ${user.email}`,
      user: {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
      },
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
