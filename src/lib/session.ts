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

// Decode session from token (base64url encoded payload.signature format)
export function decodeSession(token: string): SessionUser | null {
  try {
    // First decode URL encoding (handles %3D -> =, etc.)
    const decodedToken = decodeURIComponent(token);
    // Split by . to get payload (token format is payload.signature)
    const payload = decodedToken.split(".")[0];
    // Decode base64url payload
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));

    // Check expiration
    if (data.exp && data.exp < Date.now()) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      firstName: data.firstName || data.name?.split(" ")[0] || "",
      lastName: data.lastName || data.name?.split(" ").slice(1).join(" ") || "",
      role: data.role,
      teamId: data.teamId || null,
      teamName: data.teamName || null,
      profilePhotoUrl: data.profilePhotoUrl || null,
      commissionLevel: data.commissionLevel || null,
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
