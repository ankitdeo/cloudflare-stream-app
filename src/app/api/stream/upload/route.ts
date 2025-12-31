import { NextRequest, NextResponse } from "next/server";
import { uploadVideoChunk } from "@/lib/cloudflare";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const uploadURL = formData.get("uploadURL") as string;

    if (!file || !uploadURL) {
      return NextResponse.json(
        { success: false, error: "File and uploadURL are required" },
        { status: 400 }
      );
    }

    await uploadVideoChunk(uploadURL, file);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload video",
      },
      { status: 500 }
    );
  }
}
