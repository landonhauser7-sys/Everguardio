import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const carriers = await prisma.carriers.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        insurance_types: true,
      },
    });

    return NextResponse.json(carriers);
  } catch (error) {
    console.error("Error fetching carriers:", error);
    return NextResponse.json({ message: "Failed to fetch carriers" }, { status: 500 });
  }
}
