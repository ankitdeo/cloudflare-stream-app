import { NextRequest, NextResponse } from "next/server";
import { deleteLiveInput, getLiveInputStatus } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const liveInput = await getLiveInputStatus(id);
    
    // Convert to Video-like object for consistent API
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    const video: Video = {
      uid: liveInput.uid || id,
      meta: liveInput.meta,
      created: liveInput.created,
      modified: liveInput.modified,
      isLive: true,
      liveInputId: liveInput.uid || id,
      readyToStream: true,
      status: {
        state: liveInput.status?.state === "live" ? "ready" : "queued",
      },
      playback: {},
    };
    
    // Generate iframe URL for live inputs (primary playback method)
    if (customerSubdomain && liveInput.uid) {
      video.playback = {
        iframe: `https://${customerSubdomain}/${liveInput.uid}/iframe`,
        hls: `https://${customerSubdomain}/${liveInput.uid}/manifest/video.m3u8`,
        dash: `https://${customerSubdomain}/${liveInput.uid}/manifest/video.mpd`,
        whep: liveInput.webRTCPlayback?.url, // Keep WHEP URL available but not used for playback
      };
      video.thumbnail = `https://${customerSubdomain}/${liveInput.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
    } else {
      // Fallback if no customer subdomain
      video.playback = {
        whep: liveInput.webRTCPlayback?.url,
      };
    }
    
    return NextResponse.json({ success: true, data: video });
  } catch (error) {
    console.error("Error getting live input:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get live input",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Deleting live input: ${id}`);
    await deleteLiveInput(id);
    console.log(`Live input ${id} deleted successfully`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Live input deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting live input:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete live input";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

