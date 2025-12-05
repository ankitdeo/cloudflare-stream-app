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
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!video.playback?.hls && accountId) {
      video.playback = {
        hls: `https://customer-${accountId}.cloudflarestream.com/${video.uid}/manifest/video.m3u8`,
        dash: `https://customer-${accountId}.cloudflarestream.com/${video.uid}/manifest/video.mpd`,
      };
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

