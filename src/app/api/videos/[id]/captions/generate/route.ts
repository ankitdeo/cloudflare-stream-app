import { NextRequest, NextResponse } from "next/server";
import { generateCaptions } from "@/lib/cloudflare";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const language = body.language || "en"; // Default to English

    console.log(`Generating captions for video ${id} in language: ${language}`);
    
    await generateCaptions(id, language);
    
    console.log(`Caption generation started for video ${id}`);
    
    return NextResponse.json({
      success: true,
      message: "Caption generation started successfully",
    });
  } catch (error) {
    console.error("Error generating captions:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate captions";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

