import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  `${process.env.NEXTAUTH_URL}/api/calendar/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

// POST - Initiate Google Calendar OAuth flow
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only admins can connect Google Calendar
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only admins can connect Google Calendar" },
        { status: 403 }
      );
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        {
          message: "Google Calendar integration not configured. Please set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables."
        },
        { status: 501 }
      );
    }

    // Build the Google OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", session.user.id);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Google Calendar connection:", error);
    return NextResponse.json(
      { message: "Failed to initiate Google Calendar connection" },
      { status: 500 }
    );
  }
}
