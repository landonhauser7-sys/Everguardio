import * as jose from "jose";
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

// Simple key derivation using Web Crypto API
async function getSigningKey(secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode("nextauth-session-salt"),
      iterations: 1000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

// Encode session to signed JWT (not encrypted, but signed)
export async function encodeSession(user: SessionUser, maxAge: number = 30 * 24 * 60 * 60): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");

  const now = Math.floor(Date.now() / 1000);
  const signingKey = await getSigningKey(secret);

  const token = await new jose.SignJWT({
    ...user,
    iat: now,
    exp: now + maxAge,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAge)
    .sign(signingKey);

  return token;
}

// Decode JWT to session
export async function decodeSession(token: string): Promise<SessionUser | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const signingKey = await getSigningKey(secret);
    const { payload } = await jose.jwtVerify(token, signingKey, {
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
