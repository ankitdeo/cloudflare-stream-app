import { NextResponse } from "next/server";
import { listVideos } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET() {
  try {
    const videos = await listVideos();
    
    // Enhance videos with playback URLs if not already present
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const enhancedVideos: Video[] = videos.map((video) => {
      if (!video.playback?.hls && accountId) {
        return {
          ...video,
          playback: {
            hls: `https://customer-${accountId}.cloudflarestream.com/${video.uid}/manifest/video.m3u8`,
            dash: `https://customer-${accountId}.cloudflarestream.com/${video.uid}/manifest/video.mpd`,
          },
        };
      }
      return video;
    });
    
    return NextResponse.json({ success: true, data: enhancedVideos });
  } catch (error) {
    console.error("Error listing videos:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list videos",
      },
      { status: 500 }
    );
  }
}

