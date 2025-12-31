import { NextRequest, NextResponse } from "next/server";
import { getLiveInputStatus, getLiveInputRecordings } from "@/lib/cloudflare";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const liveInput = await getLiveInputStatus(id);
    const recordings = await getLiveInputRecordings(id);
    
    const readyRecordings = recordings.filter(
      (rec) => rec.readyToStream || rec.status?.state === "ready"
    );
    const notReadyRecordings = recordings.filter(
      (rec) => !rec.readyToStream && rec.status?.state !== "ready"
    );
    
    return NextResponse.json({
      success: true,
      data: recordings,
      details: {
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
    });
  } catch (error) {
    console.error("Error checking recordings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check recordings",
      },
      { status: 500 }
    );
  }
}
