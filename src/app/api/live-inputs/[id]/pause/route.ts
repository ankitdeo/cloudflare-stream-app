import { NextRequest, NextResponse } from "next/server";
import { pauseLiveInput } from "@/lib/cloudflare";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Pausing live input: ${id}`);
    const liveInput = await pauseLiveInput(id);
    console.log(`Live input ${id} paused successfully`);
    
    return NextResponse.json({ 
      success: true, 
      data: liveInput,
      message: "Live input paused successfully" 
    });
  } catch (error) {
    console.error("Error pausing live input:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to pause live input";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


