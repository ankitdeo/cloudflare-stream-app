import { NextRequest, NextResponse } from "next/server";
import { getLiveInputStatus, getVideo } from "@/lib/cloudflare";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inputId = searchParams.get("inputId");
    const videoId = searchParams.get("videoId");

    if (!inputId && !videoId) {
      return NextResponse.json(
        { success: false, error: "inputId or videoId is required" },
        { status: 400 }
      );
    }

    if (inputId) {
      const status = await getLiveInputStatus(inputId);
      return NextResponse.json({ success: true, data: status });
    }

    if (videoId) {
      const video = await getVideo(videoId);
      return NextResponse.json({ success: true, data: video });
    }
  } catch (error) {
    console.error("Error getting stream status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get stream status",
      },
      { status: 500 }
    );
  }
}

