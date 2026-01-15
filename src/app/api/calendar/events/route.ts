import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["training", "meeting", "announcement", "deadline", "other"]),
  start: z.string(),
  end: z.string(),
  location: z.string().optional(),
  allDay: z.boolean().optional(),
});

// GET - Fetch calendar events
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const start = startParam ? new Date(startParam) : new Date();
    const end = endParam ? new Date(endParam) : new Date();

    // Fetch events from database
    const events = await prisma.calendar_events.findMany({
      where: {
        start: {
          gte: start,
        },
        end: {
          lte: new Date(end.getTime() + 24 * 60 * 60 * 1000), // Include events ending on the last day
        },
      },
      orderBy: { start: "asc" },
    });

    // Get config
    const config = await prisma.calendar_config.findFirst();

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location,
        type: event.type.toLowerCase(),
        allDay: event.all_day,
        hangoutLink: event.hangout_link,
      })),
      config: {
        connected: config?.is_connected || false,
        calendarId: config?.google_calendar_id,
        lastSynced: config?.last_synced?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { message: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

// POST - Create a new calendar event
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create events
    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json(
        { message: "Only admins can create calendar events" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = eventSchema.parse(body);

    const eventId = crypto.randomUUID();
    const event = await prisma.calendar_events.create({
      data: {
        id: eventId,
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type.toUpperCase() as "TRAINING" | "MEETING" | "ANNOUNCEMENT" | "DEADLINE" | "OTHER",
        start: new Date(validatedData.start),
        end: new Date(validatedData.end),
        location: validatedData.location,
        all_day: validatedData.allDay || false,
        created_by_id: session.user.id,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      id: event.id,
      message: "Event created successfully",
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
