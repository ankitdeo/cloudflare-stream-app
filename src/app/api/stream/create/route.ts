import { NextRequest, NextResponse } from "next/server";
import { createDirectUpload, createLiveInput } from "@/lib/cloudflare";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = "direct", meta } = body;

    if (type === "direct") {
      const uploadData = await createDirectUpload(meta);
      return NextResponse.json({ success: true, data: uploadData });
    } else if (type === "live") {
      const liveInput = await createLiveInput(meta);
      return NextResponse.json({ success: true, data: liveInput });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid type. Use 'direct' or 'live'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error creating stream:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create stream",
      },
      { status: 500 }
    );
  }
}
