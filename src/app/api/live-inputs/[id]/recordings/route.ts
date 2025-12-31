import { NextRequest, NextResponse } from "next/server";
import { getLiveInputStatus, getLiveInputRecordings } from "@/lib/cloudflare";

/**
 * Test endpoint to manually check a live input's recording status
 * GET /api/live-inputs/[id]/recordings
 * 
 * Returns:
 * - Live input details (including recording configuration)
 * - Current status
 * - All recordings (ready and not ready)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[${new Date().toISOString()}] Checking recordings for live input ${id}...`);
    
    // Get live input status
    const liveInput = await getLiveInputStatus(id);
    
    // Get all recordings
    const recordings = await getLiveInputRecordings(id);
    
    // Separate ready and not-ready recordings
    const readyRecordings = recordings.filter(
      (rec) => rec.readyToStream || rec.status?.state === "ready"
    );
    const notReadyRecordings = recordings.filter(
      (rec) => !rec.readyToStream && rec.status?.state !== "ready"
    );
    
    const response = {
      success: true,
      data: {
        liveInput: {
          uid: liveInput.uid,
          meta: liveInput.meta,
          recording: liveInput.recording || null,
          recordingMode: liveInput.recording?.mode || 'not set',
          status: liveInput.status,
          paused: liveInput.paused,
          created: liveInput.created,
          modified: liveInput.modified,
        },
        recordings: {
          total: recordings.length,
          ready: readyRecordings.length,
          notReady: notReadyRecordings.length,
          all: recordings.map((rec) => ({
            uid: rec.uid,
            readyToStream: rec.readyToStream,
            state: rec.status?.state,
            created: rec.created,
            duration: rec.duration,
            meta: rec.meta,
          })),
        },
        timestamp: new Date().toISOString(),
      },
    };
    
    console.log(`[${new Date().toISOString()}] Recording check complete:`, {
      liveInputId: id,
      recordingMode: liveInput.recording?.mode,
      totalRecordings: recordings.length,
      readyRecordings: readyRecordings.length,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error checking recordings:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to check recordings";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


