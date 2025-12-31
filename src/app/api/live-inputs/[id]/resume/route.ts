import { NextRequest, NextResponse } from "next/server";
import { resumeLiveInput } from "@/lib/cloudflare";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Resuming live input: ${id}`);
    const liveInput = await resumeLiveInput(id);
    console.log(`Live input ${id} resumed successfully`);
    
    return NextResponse.json({ 
      success: true, 
      data: liveInput,
      message: "Live input resumed successfully" 
    });
  } catch (error) {
    console.error("Error resuming live input:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to resume live input";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


