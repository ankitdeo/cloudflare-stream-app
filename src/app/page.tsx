"use client";

import { useState, useEffect } from "react";
import StreamRecorder from "@/components/streaming/StreamRecorder";
import VideoPlayer from "@/components/player/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Video, ListVideo, Upload, AlertCircle, Trash2 } from "lucide-react";
import { Video as VideoType, EmbedSettings } from "@/types/stream";

type ViewMode = "record" | "playback" | "library";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("record");
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedSettings, setEmbedSettings] = useState<EmbedSettings>({
    autoplay: false,
    loop: false,
    preload: "auto",
    muted: false,
  });

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/videos/list");
      const data = await response.json();

      if (data.success) {
        // Show all videos, including those still processing
        // Videos that are ready will have readyToStream: true
        // Videos still processing will have status.state: "queued" or "downloading"
        const allVideos = Array.isArray(data.data) ? data.data : [];
        
        // Filter out error videos and sort: ready videos first, then by created date
        const sortedVideos = allVideos
          .filter((video: VideoType) => {
            // Show all videos except those with error state
            return video.status?.state !== "error";
          })
          .sort((a: VideoType, b: VideoType) => {
            // Ready videos first
            if (a.readyToStream && !b.readyToStream) return -1;
            if (!a.readyToStream && b.readyToStream) return 1;
            
            // Then by created date (newest first)
            const aDate = a.created ? new Date(a.created).getTime() : 0;
            const bDate = b.created ? new Date(b.created).getTime() : 0;
            return bDate - aDate;
          });
        
        console.log(`Loaded ${sortedVideos.length} videos`);
        setVideos(sortedVideos);
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

  const handleDeleteVideo = async (videoId: string, event?: React.MouseEvent) => {
    // Prevent event bubbling if called from card click
    if (event) {
      event.stopPropagation();
    }

    // Confirm deletion
    const confirmed = window.confirm(
      "Are you sure you want to delete this video? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Remove video from list
        setVideos((prevVideos) => prevVideos.filter((v) => v.uid !== videoId));
        
        // If deleted video was selected, clear selection
        if (selectedVideo?.uid === videoId) {
          setSelectedVideo(null);
          setViewMode("library");
        }
      } else {
        setError(data.error || "Failed to delete video");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete video");
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
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteVideo(selectedVideo.uid)}
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
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
              </div>
              
              {/* Embed Settings Controls */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Embed Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Autoplay */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={embedSettings.autoplay}
                      onChange={(e) =>
                        setEmbedSettings({ ...embedSettings, autoplay: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Autoplay</span>
                  </label>
                  
                  {/* Loop */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={embedSettings.loop}
                      onChange={(e) =>
                        setEmbedSettings({ ...embedSettings, loop: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Loop</span>
                  </label>
                  
                  {/* Muted */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={embedSettings.muted}
                      onChange={(e) =>
                        setEmbedSettings({ ...embedSettings, muted: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Muted</span>
                  </label>
                  
                  {/* Preload */}
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Preload
                    </label>
                    <select
                      value={embedSettings.preload}
                      onChange={(e) =>
                        setEmbedSettings({
                          ...embedSettings,
                          preload: e.target.value as "auto" | "metadata" | "none",
                        })
                      }
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">Auto</option>
                      <option value="metadata">Metadata</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <VideoPlayer video={selectedVideo} embedSettings={embedSettings} />
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
                      className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md transition-shadow ${
                        video.readyToStream ? "hover:shadow-lg" : "opacity-75"
                      }`}
                    >
                      <div
                        onClick={() => {
                          if (video.readyToStream) {
                            handleVideoSelect(video);
                          }
                        }}
                        className={video.readyToStream ? "cursor-pointer" : "cursor-not-allowed"}
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
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate flex-1">
                              {video.meta?.name || `Video ${video.uid.slice(0, 8)}`}
                            </h3>
                            {!video.readyToStream && (
                              <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                Processing
                              </span>
                            )}
                          </div>
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
                      <div className="px-4 pb-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleDeleteVideo(video.uid, e)}
                          disabled={isLoading}
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
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
