import { NextRequest, NextResponse } from "next/server";
import { getVideo, deleteVideo } from "@/lib/cloudflare";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await getVideo(id);
    
    // Enhance video object with playback URLs if not already present
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    if (customerSubdomain) {
      if (!video.playback) {
        video.playback = {};
      }
      // Add iframe URL (primary playback method)
      if (!video.playback.iframe) {
        video.playback.iframe = `https://${customerSubdomain}/${video.uid}/iframe`;
      }
      // Keep HLS/DASH for backward compatibility if needed
      if (!video.playback.hls) {
        video.playback.hls = `https://${customerSubdomain}/${video.uid}/manifest/video.m3u8`;
      }
      if (!video.playback.dash) {
        video.playback.dash = `https://${customerSubdomain}/${video.uid}/manifest/video.mpd`;
      }
    }
    
    return NextResponse.json({ success: true, data: video });
  } catch (error) {
    console.error("Error getting video:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get video",
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
    console.log(`Deleting video: ${id}`);
    await deleteVideo(id);
    console.log(`Video ${id} deleted successfully`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Video deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete video";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

