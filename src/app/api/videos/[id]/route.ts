import { NextRequest, NextResponse } from "next/server";
import { getVideo, deleteVideo, generateSignedToken } from "@/lib/cloudflare";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await getVideo(id);
    
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    if (customerSubdomain) {
      if (!video.playback) {
        video.playback = {};
      }
      
      let signedToken: string | null = null;
      try {
        signedToken = await generateSignedToken(video.uid);
      } catch {
        // Fall back to UID if token generation fails
      }
      
      const playbackId = signedToken || video.uid;
      
      if (signedToken && customerSubdomain) {
        if (video.thumbnail && video.thumbnail.includes(video.uid)) {
          video.thumbnail = video.thumbnail.replace(video.uid, signedToken);
        } else {
          video.thumbnail = `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg?time=1s&height=270`;
        }
      } else if (!video.thumbnail && customerSubdomain) {
        video.thumbnail = `https://${customerSubdomain}/${video.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
      }
      
      if (customerSubdomain) {
        const whepUrl = `https://${customerSubdomain}/${playbackId}/webRTC/play`;
        if (!video.playback.whep) {
          video.playback.whep = whepUrl;
        }
      }
      
      if (!video.playback.iframe) {
        video.playback.iframe = `https://${customerSubdomain}/${playbackId}/iframe`;
      }
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
    await deleteVideo(id);
    
    return NextResponse.json({ 
      success: true, 
      message: "Video deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete video",
      },
      { status: 500 }
    );
  }
}
