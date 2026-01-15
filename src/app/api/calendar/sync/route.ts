import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

// Helper to refresh access token if expired
async function getValidAccessToken(config: {
  id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: Date | null;
}) {
  // Check if token is still valid (with 5 minute buffer)
  if (
    config.google_token_expiry &&
    config.google_token_expiry > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return config.google_access_token;
  }

  // Token expired, refresh it
  if (!config.google_refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Unable to refresh token - missing credentials");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: config.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh token");
  }

  const tokens = await tokenResponse.json();

  // Update tokens in database
  await prisma.calendar_config.update({
    where: { id: config.id },
    data: {
      google_access_token: tokens.access_token,
      google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000),
      updated_at: new Date(),
    },
  });

  return tokens.access_token;
}

// Categorize event based on title/description
function categorizeEvent(title: string, description?: string): "TRAINING" | "MEETING" | "ANNOUNCEMENT" | "DEADLINE" | "OTHER" {
  const text = `${title} ${description || ""}`.toLowerCase();

  if (text.includes("training") || text.includes("workshop") || text.includes("course")) {
    return "TRAINING";
  }
  if (text.includes("meeting") || text.includes("call") || text.includes("sync") || text.includes("standup")) {
    return "MEETING";
  }
  if (text.includes("announcement") || text.includes("update") || text.includes("news")) {
    return "ANNOUNCEMENT";
  }
  if (text.includes("deadline") || text.includes("due") || text.includes("submit")) {
    return "DEADLINE";
  }
  return "OTHER";
}

// POST - Sync events from Google Calendar
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only admins can sync
    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { message: "Only admins can sync calendar" },
        { status: 403 }
      );
    }

    // Get config
    const config = await prisma.calendar_config.findFirst();

    if (!config || !config.is_connected) {
      return NextResponse.json(
        { message: "Google Calendar not connected" },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(config);

    if (!accessToken) {
      return NextResponse.json(
        { message: "Unable to get valid access token" },
        { status: 401 }
      );
    }

    // Fetch events from Google Calendar (next 3 months)
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const calendarId = config.google_calendar_id || "primary";
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    eventsUrl.searchParams.set("timeMin", now.toISOString());
    eventsUrl.searchParams.set("timeMax", threeMonthsLater.toISOString());
    eventsUrl.searchParams.set("singleEvents", "true");
    eventsUrl.searchParams.set("orderBy", "startTime");
    eventsUrl.searchParams.set("maxResults", "250");

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Failed to fetch Google Calendar events:", errorText);
      return NextResponse.json(
        { message: "Failed to fetch events from Google Calendar" },
        { status: 500 }
      );
    }

    const eventsData = await eventsResponse.json();
    const googleEvents = eventsData.items || [];

    let created = 0;
    let updated = 0;

    // Upsert events
    for (const gEvent of googleEvents) {
      if (!gEvent.id || gEvent.status === "cancelled") continue;

      const startDateTime = gEvent.start?.dateTime || gEvent.start?.date;
      const endDateTime = gEvent.end?.dateTime || gEvent.end?.date;

      if (!startDateTime || !endDateTime) continue;

      const isAllDay = !gEvent.start?.dateTime;
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      // Check if event already exists
      const existingEvent = await prisma.calendar_events.findUnique({
        where: { google_event_id: gEvent.id },
      });

      const eventData = {
        title: gEvent.summary || "Untitled Event",
        description: gEvent.description,
        start,
        end,
        location: gEvent.location,
        type: categorizeEvent(gEvent.summary || "", gEvent.description),
        all_day: isAllDay,
        hangout_link: gEvent.hangoutLink,
        updated_at: new Date(),
      };

      if (existingEvent) {
        await prisma.calendar_events.update({
          where: { id: existingEvent.id },
          data: eventData,
        });
        updated++;
      } else {
        await prisma.calendar_events.create({
          data: {
            id: crypto.randomUUID(),
            google_event_id: gEvent.id,
            ...eventData,
          },
        });
        created++;
      }
    }

    // Update last synced timestamp
    await prisma.calendar_config.update({
      where: { id: config.id },
      data: {
        last_synced: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      message: "Calendar synced successfully",
      created,
      updated,
      total: googleEvents.length,
    });
  } catch (error) {
    console.error("Error syncing calendar:", error);
    return NextResponse.json(
      { message: "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
