import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  `${process.env.NEXTAUTH_URL}/api/calendar/callback`;

// GET - Handle Google OAuth callback
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL("/calendar?error=google_auth_failed", request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/calendar?error=no_code", request.url)
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL("/calendar?error=not_configured", request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/calendar?error=token_exchange_failed", request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get the primary calendar ID
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    let calendarId = "primary";
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id || "primary";
    }

    // Store the tokens in database
    const existingConfig = await prisma.calendar_config.findFirst();

    if (existingConfig) {
      await prisma.calendar_config.update({
        where: { id: existingConfig.id },
        data: {
          google_calendar_id: calendarId,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || existingConfig.google_refresh_token,
          google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000),
          is_connected: true,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.calendar_config.create({
        data: {
          id: crypto.randomUUID(),
          google_calendar_id: calendarId,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000),
          is_connected: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    // Redirect back to calendar page
    return NextResponse.redirect(
      new URL("/calendar?connected=true", request.url)
    );
  } catch (error) {
    console.error("Error in Google Calendar callback:", error);
    return NextResponse.redirect(
      new URL("/calendar?error=callback_failed", request.url)
    );
  }
}
