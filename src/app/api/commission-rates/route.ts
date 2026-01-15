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
    const userId = searchParams.get("userId");
    const carrierId = searchParams.get("carrierId");

    const where: Record<string, string> = {};
    if (userId) where.user_id = userId;
    if (carrierId) where.carrier_id = carrierId;

    const rates = await prisma.commission_rates.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            role: true,
          },
        },
        carriers: {
          select: {
            id: true,
            name: true,
            insurance_types: true,
            default_agent_rate: true,
            default_manager_rate: true,
          },
        },
      },
      orderBy: [
        { users: { last_name: "asc" } },
        { carriers: { name: "asc" } },
      ],
    });

    return NextResponse.json(rates);
  } catch (error) {
    console.error("Error fetching commission rates:", error);
    return NextResponse.json({ message: "Failed to fetch commission rates" }, { status: 500 });
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
    const { user_id, carrier_id, agent_rate, manager_rate } = body;

    if (!user_id || !carrier_id) {
      return NextResponse.json({ message: "User and carrier are required" }, { status: 400 });
    }

    // Check if rate already exists
    const existing = await prisma.commission_rates.findUnique({
      where: {
        user_id_carrier_id: { user_id, carrier_id },
      },
    });

    if (existing) {
      // Update existing rate
      const rate = await prisma.commission_rates.update({
        where: { id: existing.id },
        data: {
          agent_rate: agent_rate ?? existing.agent_rate,
          manager_rate: manager_rate ?? existing.manager_rate,
          updated_at: new Date(),
        },
        include: {
          users: { select: { id: true, first_name: true, last_name: true } },
          carriers: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(rate);
    }

    // Create new rate
    const rate = await prisma.commission_rates.create({
      data: {
        id: randomUUID(),
        user_id,
        carrier_id,
        agent_rate: agent_rate ?? 0.70,
        manager_rate: manager_rate ?? 0.30,
        updated_at: new Date(),
      },
      include: {
        users: { select: { id: true, first_name: true, last_name: true } },
        carriers: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rate, { status: 201 });
  } catch (error) {
    console.error("Error creating commission rate:", error);
    return NextResponse.json({ message: "Failed to create commission rate" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!["AO", "PARTNER"].includes(session.user.role || "")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Rate ID is required" }, { status: 400 });
    }

    await prisma.commission_rates.delete({ where: { id } });

    return NextResponse.json({ message: "Commission rate deleted" });
  } catch (error) {
    console.error("Error deleting commission rate:", error);
    return NextResponse.json({ message: "Failed to delete commission rate" }, { status: 500 });
  }
}
