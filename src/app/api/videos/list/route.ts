import { NextResponse } from "next/server";
import { listVideos, generateSignedToken, listLiveInputs, getLiveInputRecordings } from "@/lib/cloudflare";
import { Video } from "@/types/stream";

export async function GET() {
  try {
    const [videos, liveInputs] = await Promise.all([
      listVideos(),
      listLiveInputs(),
    ]);
    
    // Fetch recorded videos from all live inputs
    const allRecordings: Video[] = [];
    for (const liveInput of liveInputs) {
      if (liveInput.uid) {
        try {
          const recordings = await getLiveInputRecordings(liveInput.uid);
          
          const readyRecordings = recordings
            .filter((recording: Video) => {
              const stateReady = recording.status?.state === "ready";
              const readyToStream = recording.readyToStream === true;
              return stateReady || readyToStream;
            })
            .map((recording: Video) => ({
              ...recording,
              isLive: false,
              isLiveRecording: true,
              liveInputId: liveInput.uid,
            }));
          
          allRecordings.push(...readyRecordings);
        } catch {
          // Ignore errors fetching recordings for individual live inputs
        }
      }
    }
    
    // Deduplicate recordings
    const existingVideoUids = new Set(videos.map((v) => v.uid));
    const uniqueRecordings = allRecordings.filter(
      (recording) => !existingVideoUids.has(recording.uid)
    );
    
    const customerSubdomain = process.env.CUSTOMER_SUBDOMAIN;
    
    // Enhance videos with playback URLs
    const enhancedVideos: Video[] = await Promise.all(
      videos.map(async (video) => {
        if (customerSubdomain) {
          const playback = video.playback || {};
          
          let signedToken: string | null = null;
          try {
            signedToken = await generateSignedToken(video.uid);
          } catch {
            // Fall back to UID if token generation fails
          }
          
          const playbackId = signedToken || video.uid;
          
          let thumbnailUrl = video.thumbnail;
          if (signedToken && customerSubdomain) {
            if (thumbnailUrl && thumbnailUrl.includes(video.uid)) {
              thumbnailUrl = thumbnailUrl.replace(video.uid, signedToken);
            } else {
              thumbnailUrl = `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg?time=1s&height=270`;
            }
          } else if (!thumbnailUrl && customerSubdomain) {
            thumbnailUrl = `https://${customerSubdomain}/${video.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
          }
          
          const whepUrl = customerSubdomain 
            ? `https://${customerSubdomain}/${playbackId}/webRTC/play`
            : undefined;
          
          return {
            ...video,
            thumbnail: thumbnailUrl,
            playback: {
              iframe: playback.iframe || `https://${customerSubdomain}/${playbackId}/iframe`,
              hls: playback.hls || `https://${customerSubdomain}/${playbackId}/manifest/video.m3u8`,
              dash: playback.dash || `https://${customerSubdomain}/${playbackId}/manifest/video.mpd`,
              whep: whepUrl || playback.whep,
            },
          };
        }
        return video;
      })
    );
    
    // Enhance recorded videos from live inputs
    const enhancedRecordings: Video[] = await Promise.all(
      uniqueRecordings.map(async (recording) => {
        if (recording.isLive !== false) {
          recording.isLive = false;
        }
        
        if (customerSubdomain) {
          const playback = recording.playback || {};
          
          let signedToken: string | null = null;
          try {
            signedToken = await generateSignedToken(recording.uid);
          } catch {
            // Fall back to UID if token generation fails
          }
          
          const playbackId = signedToken || recording.uid;
          
          let thumbnailUrl = recording.thumbnail;
          if (signedToken && customerSubdomain) {
            if (thumbnailUrl && thumbnailUrl.includes(recording.uid)) {
              thumbnailUrl = thumbnailUrl.replace(recording.uid, signedToken);
            } else {
              thumbnailUrl = `https://${customerSubdomain}/${signedToken}/thumbnails/thumbnail.jpg?time=1s&height=270`;
            }
          } else if (!thumbnailUrl && customerSubdomain) {
            thumbnailUrl = `https://${customerSubdomain}/${recording.uid}/thumbnails/thumbnail.jpg?time=1s&height=270`;
          }
          
          const iframeUrl = `https://${customerSubdomain}/${playbackId}/iframe`;
          const hlsUrl = `https://${customerSubdomain}/${playbackId}/manifest/video.m3u8`;
          const dashUrl = `https://${customerSubdomain}/${playbackId}/manifest/video.mpd`;
          
          return {
            ...recording,
            isLive: false,
            readyToStream: recording.readyToStream ?? true,
            thumbnail: thumbnailUrl,
            playback: {
              iframe: playback.iframe || iframeUrl,
              hls: playback.hls || hlsUrl,
              dash: playback.dash || dashUrl,
              whep: playback.whep,
            },
          };
        }
        
        return {
          ...recording,
          isLive: false,
          readyToStream: recording.readyToStream ?? true,
        };
      })
    );
    
    // Combine and sort by creation date
    const allVideos = [...enhancedVideos, ...enhancedRecordings].sort((a, b) => {
      const aDate = a.created ? new Date(a.created).getTime() : 0;
      const bDate = b.created ? new Date(b.created).getTime() : 0;
      return bDate - aDate;
    });
    
    return NextResponse.json({ success: true, data: allVideos });
  } catch (error) {
    console.error("Error listing videos:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list videos",
      },
      { status: 500 }
    );
  }
}
