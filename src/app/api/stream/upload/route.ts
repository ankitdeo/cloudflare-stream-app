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

    console.log("Upload request received:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadURL: uploadURL.substring(0, 50) + "...",
    });

    // Upload to Cloudflare using server-side function
    // Pass File directly - it will be converted to FormData with field name "file"
    await uploadVideoChunk(uploadURL, file);

    console.log("Upload completed successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error uploading video:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

