import { cookies } from "next/headers";

// Session types
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  profilePhotoUrl: string | null;
  commissionLevel: number | null;
}

export interface Session {
  user: SessionUser;
  expires: string;
}

// Cookie name based on environment
const getCookieName = () => {
  return process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
};

// Decode session from token
export function decodeSession(token: string): SessionUser | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";

    // Token format: base64url(payload).signature
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    // Verify signature
    const expectedSignature = Buffer.from(secret + payload).toString("base64url").slice(0, 43);
    if (signature !== expectedSignature) {
      console.error("Invalid session signature");
      return null;
    }

    // Decode payload
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));

    // Check expiration
    if (data.exp && data.exp < Date.now()) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      teamId: data.teamId,
      teamName: data.teamName,
      profilePhotoUrl: data.profilePhotoUrl,
      commissionLevel: data.commissionLevel,
    };
  } catch (error) {
    console.error("Failed to decode session:", error);
    return null;
  }
}

// Get session from cookies (for server components/API routes)
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getCookieName())?.value;

    if (!token) return null;

    const user = decodeSession(token);
    if (!user) return null;

    return {
      user,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getCookieName());
}
