import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const steps: string[] = [];

  try {
    steps.push("start");

    // Try importing jose dynamically
    const jose = await import("jose");
    steps.push("jose imported");

    const secret = new TextEncoder().encode("test-secret-key-12345");
    steps.push("secret created");

    const token = await new jose.SignJWT({ test: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(secret);
    steps.push("token created: " + token.substring(0, 20) + "...");

    return NextResponse.json({ success: true, steps });
  } catch (error) {
    return NextResponse.json({
      success: false,
      steps,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
