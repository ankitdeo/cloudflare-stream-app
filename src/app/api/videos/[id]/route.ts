import { NextRequest, NextResponse } from "next/server";
import { getVideo, deleteVideo, generateSignedToken } from "@/lib/cloudflare";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await getVideo(id);
    
    // Enhance video object with playback URLs using signed tokens
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    if (customerSubdomain) {
      if (!video.playback) {
        video.playback = {};
      }
      
      // Generate signed token for secure playback
      let signedToken: string | null = null;
      try {
        signedToken = await generateSignedToken(video.uid);
      } catch (tokenError) {
        console.warn(`Failed to generate signed token for video ${video.uid}:`, tokenError);
        // If token generation fails, fall back to UID (for backwards compatibility)
        // This handles cases where video doesn't require signed URLs yet
      }
      
      // Use signed token if available, otherwise fall back to UID
      const playbackId = signedToken || video.uid;
      
      // Generate thumbnail URL using signed token if available
      if (signedToken && customerSubdomain) {
        // If we have a signed token, replace UID in thumbnail URL with token
        if (video.thumbnail && video.thumbnail.includes(video.uid)) {
          // Replace UID with signed token in existing thumbnail URL
          video.thumbnail = video.thumbnail.replace(video.uid, signedToken);
        } else {
          // Construct new thumbnail URL with signed token
          video.thumbnail = `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg?time=1s&height=270`;
        }
      } else if (!video.thumbnail && customerSubdomain) {
        // Fallback: construct thumbnail URL with UID if no thumbnail provided
        video.thumbnail = `https://${customerSubdomain}/${video.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
      }
      
      // Add iframe URL (primary playback method)
      if (!video.playback.iframe) {
        video.playback.iframe = `https://${customerSubdomain}/${playbackId}/iframe`;
      }
      // Keep HLS/DASH for backward compatibility if needed
      if (!video.playback.hls) {
        video.playback.hls = `https://${customerSubdomain}/${playbackId}/manifest/video.m3u8`;
      }
      if (!video.playback.dash) {
        video.playback.dash = `https://${customerSubdomain}/${playbackId}/manifest/video.mpd`;
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

