import * as jose from "jose";
import { hkdf } from "@panva/hkdf";
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

// Generate UUID (fallback for environments without crypto.randomUUID)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Cookie name based on environment
const getCookieName = () => {
  return process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
};

// Derive encryption key (same as NextAuth)
async function getDerivedEncryptionKey(secret: string): Promise<Uint8Array> {
  return await hkdf(
    "sha256",
    secret,
    "",
    "NextAuth.js Generated Encryption Key",
    32
  );
}

// Encode session to JWT
export async function encodeSession(user: SessionUser, maxAge: number = 30 * 24 * 60 * 60): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");

  const now = Math.floor(Date.now() / 1000);
  const encryptionKey = await getDerivedEncryptionKey(secret);

  const token = await new jose.EncryptJWT({
    ...user,
    iat: now,
    exp: now + maxAge,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAge)
    .setJti(generateUUID())
    .encrypt(encryptionKey);

  return token;
}

// Decode JWT to session
export async function decodeSession(token: string): Promise<SessionUser | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const encryptionKey = await getDerivedEncryptionKey(secret);
    const { payload } = await jose.jwtDecrypt(token, encryptionKey, {
      clockTolerance: 15,
    });

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      role: payload.role as string,
      teamId: payload.teamId as string | null,
      teamName: payload.teamName as string | null,
      profilePhotoUrl: payload.profilePhotoUrl as string | null,
      commissionLevel: payload.commissionLevel as number | null,
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

    const user = await decodeSession(token);
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

// Set session cookie
export async function setSessionCookie(token: string, maxAge: number = 30 * 24 * 60 * 60) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set(getCookieName(), token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(getCookieName());
}
