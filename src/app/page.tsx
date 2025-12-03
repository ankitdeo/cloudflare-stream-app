"use client";

import { useState, useEffect } from "react";
import StreamRecorder from "@/components/streaming/StreamRecorder";
import VideoPlayer from "@/components/player/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Video, ListVideo, Upload, AlertCircle } from "lucide-react";
import { Video as VideoType } from "@/types/stream";

type ViewMode = "record" | "playback" | "library";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("record");
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/videos/list");
      const data = await response.json();

      if (data.success) {
        // Filter only ready videos
        const readyVideos = data.data.filter(
          (video: VideoType) => video.readyToStream || video.status?.state === "ready"
        );
        setVideos(readyVideos);
      } else {
        setError(data.error || "Failed to fetch videos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch videos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "library") {
      fetchVideos();
    }
  }, [viewMode]);

  const handleRecordingComplete = (videoId: string) => {
    // Switch to library view and refresh videos
    setViewMode("library");
    setTimeout(() => {
      fetchVideos();
    }, 2000); // Wait a bit for video to be processed
  };

  const handleVideoSelect = async (video: VideoType) => {
    try {
      setIsLoading(true);
      // Fetch full video details to get playback URLs
      const response = await fetch(`/api/videos/${video.uid}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedVideo(data.data);
        setViewMode("playback");
      } else {
        setError(data.error || "Failed to load video details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Cloudflare Stream Live
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Record and stream videos to Cloudflare Stream
          </p>
        </header>

        {/* Navigation */}
        <nav className="mb-8">
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant={viewMode === "record" ? "default" : "ghost"}
              onClick={() => {
                setViewMode("record");
                setSelectedVideo(null);
              }}
              className="rounded-b-none"
            >
              <Video className="w-4 h-4 mr-2" />
              Record
            </Button>
            <Button
              variant={viewMode === "playback" ? "default" : "ghost"}
              onClick={() => {
                if (selectedVideo) {
                  setViewMode("playback");
                }
              }}
              disabled={!selectedVideo}
              className="rounded-b-none"
            >
              <Upload className="w-4 h-4 mr-2" />
              Playback
            </Button>
            <Button
              variant={viewMode === "library" ? "default" : "ghost"}
              onClick={() => {
                setViewMode("library");
                setSelectedVideo(null);
              }}
              className="rounded-b-none"
            >
              <ListVideo className="w-4 h-4 mr-2" />
              Library
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main>
          {viewMode === "record" && (
            <div className="space-y-4">
              <StreamRecorder onRecordingComplete={handleRecordingComplete} />
            </div>
          )}

          {viewMode === "playback" && selectedVideo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {selectedVideo.meta?.name || "Video Playback"}
                </h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewMode("library");
                    setSelectedVideo(null);
                  }}
                >
                  Back to Library
                </Button>
              </div>
              <VideoPlayer video={selectedVideo} />
            </div>
          )}

          {viewMode === "library" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Video Library
                </h2>
                <Button onClick={fetchVideos} disabled={isLoading}>
                  {isLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {isLoading && videos.length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  Loading videos...
                </div>
              ) : videos.length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  No videos found. Start recording to upload your first video!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <div
                      key={video.uid}
                      onClick={() => handleVideoSelect(video)}
                      className="cursor-pointer bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
                    >
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.meta?.name || "Video thumbnail"}
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Video className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {video.meta?.name || `Video ${video.uid.slice(0, 8)}`}
                        </h3>
                        {video.duration && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Duration: {Math.round(video.duration)}s
                          </p>
                        )}
                        {video.created && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(video.created).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
