import { NextResponse } from "next/server";
import { listVideos } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET() {
  try {
    console.log("Fetching videos from Cloudflare Stream...");
    const videos = await listVideos();
    
    console.log(`Retrieved ${videos.length} videos from Cloudflare`);
    
    // Enhance videos with playback URLs if not already present
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    const enhancedVideos: Video[] = videos.map((video) => {
      if (customerSubdomain) {
        const playback = video.playback || {};
        return {
          ...video,
          playback: {
            iframe: playback.iframe || `https://${customerSubdomain}/${video.uid}/iframe`,
            hls: playback.hls || `https://${customerSubdomain}/${video.uid}/manifest/video.m3u8`,
            dash: playback.dash || `https://${customerSubdomain}/${video.uid}/manifest/video.mpd`,
          },
        };
      }
      return video;
    });
    
    return NextResponse.json({ success: true, data: enhancedVideos });
  } catch (error) {
    console.error("Error listing videos:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to list videos";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

