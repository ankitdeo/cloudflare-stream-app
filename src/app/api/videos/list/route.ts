import { NextResponse } from "next/server";
import { listVideos, generateSignedToken } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET() {
  try {
    console.log("Fetching videos from Cloudflare Stream...");
    const videos = await listVideos();
    
    console.log(`Retrieved ${videos.length} videos from Cloudflare`);
    
    // Enhance videos with playback URLs using signed tokens
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    const enhancedVideos: Video[] = await Promise.all(
      videos.map(async (video) => {
        if (customerSubdomain) {
          const playback = video.playback || {};
          
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
          // Format: https://customer-subdomain.cloudflarestream.com/{token}/thumbnails/thumbnail.jpg
          let thumbnailUrl = video.thumbnail;
          if (signedToken && customerSubdomain) {
            // If we have a signed token, replace UID in thumbnail URL with token
            // This handles both cases: existing thumbnail URLs and new ones
            if (thumbnailUrl && thumbnailUrl.includes(video.uid)) {
              // Replace UID with signed token in existing thumbnail URL
              thumbnailUrl = thumbnailUrl.replace(video.uid, signedToken);
            } else {
              // Construct new thumbnail URL with signed token
              thumbnailUrl = `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg?time=1s&height=270`;
            }
          } else if (!thumbnailUrl && customerSubdomain) {
            // Fallback: construct thumbnail URL with UID if no thumbnail provided
            thumbnailUrl = `https://${customerSubdomain}/${video.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
          }
          
          return {
            ...video,
            thumbnail: thumbnailUrl,
            playback: {
              iframe: playback.iframe || `https://${customerSubdomain}/${playbackId}/iframe`,
              hls: playback.hls || `https://${customerSubdomain}/${playbackId}/manifest/video.m3u8`,
              dash: playback.dash || `https://${customerSubdomain}/${playbackId}/manifest/video.mpd`,
            },
          };
        }
        return video;
      })
    );
    
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

