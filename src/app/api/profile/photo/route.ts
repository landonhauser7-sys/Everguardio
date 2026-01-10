import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.user.id}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Update user's profile photo URL in database
    const photoUrl = `/uploads/avatars/${filename}`;

    await prisma.users.update({
      where: { id: session.user.id },
      data: {
        profile_photo_url: photoUrl,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      message: "Photo uploaded successfully",
      photoUrl
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { message: "Failed to upload photo" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Clear the profile photo URL
    await prisma.users.update({
      where: { id: session.user.id },
      data: {
        profile_photo_url: null,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ message: "Photo removed successfully" });
  } catch (error) {
    console.error("Error removing photo:", error);
    return NextResponse.json(
      { message: "Failed to remove photo" },
      { status: 500 }
    );
  }
}
