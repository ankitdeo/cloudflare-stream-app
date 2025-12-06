"use client";

import { Video, EmbedSettings } from "@/types/stream";

interface VideoPlayerProps {
  video: Video;
  embedSettings?: EmbedSettings;
}

export default function VideoPlayer({ video, embedSettings }: VideoPlayerProps) {
  // Get iframe URL from video object (already set by API routes)
  const iframeBaseUrl = video.playback?.iframe;

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

  // Match the exact HTML structure from the reference
  return (
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
  );
}
