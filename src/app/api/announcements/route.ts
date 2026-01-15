import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const includeExpired = searchParams.get("includeExpired") === "true";

    const now = new Date();

    const announcements = await prisma.announcements.findMany({
      where: {
        ...(activeOnly && { is_active: true }),
        ...(!includeExpired && {
          OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        }),
      },
      orderBy: [{ priority: "desc" }, { created_at: "desc" }],
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({ message: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, priority, expires_at } = body;

    if (!title || !message) {
      return NextResponse.json({ message: "Title and message are required" }, { status: 400 });
    }

    const announcement = await prisma.announcements.create({
      data: {
        id: randomUUID(),
        title,
        message,
        priority: priority || "NORMAL",
        expires_at: expires_at ? new Date(expires_at) : null,
        created_by_id: session.user.id,
        updated_at: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json({ message: "Failed to create announcement" }, { status: 500 });
  }
}
