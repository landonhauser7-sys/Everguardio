// Custom auth module - replaces NextAuth
// All existing getServerSession(authOptions) calls will continue to work

import { getSession as getSessionFromLib } from "./session";

// Export a dummy authOptions for backward compatibility
// This is only used as a parameter signature - the actual implementation ignores it
export const authOptions = {};

// Custom getServerSession that wraps our session implementation
// This maintains compatibility with existing code that does:
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// const session = await getServerSession(authOptions);
export async function getServerSession(_authOptions?: unknown) {
  return await getSessionFromLib();
}
