import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });

    // Clear both cookie variants
    response.cookies.set("__Secure-next-auth.session-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("next-auth.session-token", "", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
  }
}
