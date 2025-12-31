"use client";

import { Video, EmbedSettings } from "@/types/stream";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";
import { useState, useEffect } from "react";

interface VideoPlayerProps {
  video: Video;
  embedSettings?: EmbedSettings;
  onPauseResume?: (pause: boolean) => Promise<void>;
}

export default function VideoPlayer({ video, embedSettings, onPauseResume }: VideoPlayerProps) {
  const [isPaused, setIsPaused] = useState(video.paused || false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get iframe URL from video object (already set by API routes)
  const iframeBaseUrl = video.playback?.iframe;

  // Update paused state when video prop changes
  useEffect(() => {
    setIsPaused(video.paused || false);
  }, [video.paused]);

  const handlePauseResume = async () => {
    if (!onPauseResume || !video.isLive) return;
    
    setIsLoading(true);
    try {
      await onPauseResume(!isPaused);
      setIsPaused(!isPaused);
    } catch (err) {
      console.error("Error pausing/resuming:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!iframeBaseUrl) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-lg mb-2">Video playback URL not available</p>
          <p className="text-sm text-gray-400">The video may still be processing</p>
        </div>
      </div>
    );
  }

  // Build iframe URL with embed settings as query parameters
  // Cloudflare's iframe player supports autoplay, loop, muted, and preload parameters
  const buildIframeUrl = () => {
    try {
      const url = new URL(iframeBaseUrl);
      
      // Apply embed settings if provided
      if (embedSettings) {
        if (embedSettings.autoplay) {
          url.searchParams.set("autoplay", "true");
        }
        if (embedSettings.loop) {
          url.searchParams.set("loop", "true");
        }
        if (embedSettings.muted) {
          url.searchParams.set("muted", "true");
        }
        if (embedSettings.preload && embedSettings.preload !== "auto") {
          url.searchParams.set("preload", embedSettings.preload);
        }
      }
      
      return url.toString();
    } catch (e) {
      console.error("Failed to build iframe URL:", e);
      return iframeBaseUrl;
    }
  };

  const iframeUrl = buildIframeUrl();
  const isLiveStream = video.isLive;

  // Match the exact HTML structure from the reference
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div style={{ position: "relative", paddingTop: "56.25%" }}>
        <iframe
          src={iframeUrl}
          loading="lazy"
          style={{
            border: "none",
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: "100%",
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen={true}
          title={video.meta?.name || "Video Player"}
        />
      </div>
      
      {/* Pause/Resume controls for live streams */}
      {isLiveStream && onPauseResume && (
        <div className="mt-4 flex items-center justify-center">
          <Button
            onClick={handlePauseResume}
            variant="outline"
            size="lg"
            disabled={isLoading}
          >
            {isPaused ? (
              <>
                <Play className="w-5 h-5 mr-2" />
                Resume Stream
              </>
            ) : (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Pause Stream
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
