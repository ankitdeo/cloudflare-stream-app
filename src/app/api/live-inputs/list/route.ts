import { NextResponse } from "next/server";
import { listLiveInputs } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET() {
  try {
    console.log("Fetching live inputs from Cloudflare Stream...");
    const liveInputs = await listLiveInputs();
    
    console.log(`Retrieved ${liveInputs.length} live inputs from Cloudflare`);
    
    // Convert live inputs to Video-like objects for consistent display
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    const videos: Video[] = liveInputs.map((input) => {
      const video: Video = {
        uid: input.uid || "",
        meta: input.meta,
        created: input.created,
        modified: input.modified,
        isLive: true,
        liveInputId: input.uid,
        readyToStream: true, // Live inputs are always ready to stream
        status: {
          state: input.status?.state === "live" ? "ready" : "queued",
        },
        playback: {
          whep: input.webRTCPlayback?.url,
        },
      };
      
      // Generate thumbnail URL if customer subdomain is available
      if (customerSubdomain && input.uid) {
        video.thumbnail = `https://${customerSubdomain}/${input.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
      }
      
      return video;
    });
    
    return NextResponse.json({ success: true, data: videos });
  } catch (error) {
    console.error("Error listing live inputs:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to list live inputs";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}


