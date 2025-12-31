"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video, Upload, Square, AlertCircle, Pause, Play } from "lucide-react";
import { WHIPClient } from "@eyevinn/whip-web-client";

interface StreamRecorderProps {
  onRecordingComplete?: (videoId: string) => void;
}

// Helper function to poll video status until ready, then generate captions
const pollVideoReadinessAndGenerateCaptions = (videoId: string): void => {
  const maxAttempts = 60;
  const pollInterval = 5000;
  let attempts = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  const checkAndGenerate = async (): Promise<void> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    try {
      attempts++;
      const statusResponse = await fetch(`/api/stream/status?videoId=${videoId}`);
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to check video status: ${statusResponse.status}`);
      }

      const statusResult = await statusResponse.json();
      
      if (statusResult.success && statusResult.data) {
        const video = statusResult.data;
        
        if (video.readyToStream) {
          try {
            await fetch(`/api/videos/${videoId}/captions/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ language: "en" }),
            });
          } catch {
            // Caption generation is optional, ignore errors
          }
          return;
        }
        
        if (video.status?.state === "error") {
          return;
        }
      }

      if (attempts < maxAttempts) {
        timeoutId = setTimeout(checkAndGenerate, pollInterval);
      }
    } catch {
      if (attempts < maxAttempts) {
        timeoutId = setTimeout(checkAndGenerate, pollInterval);
      }
    }
  };

  timeoutId = setTimeout(checkAndGenerate, 2000);
};

// Helper function for uploading video through our API route
const uploadVideoChunk = (
  uploadURL: string,
  chunk: Blob,
  fileName?: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = (e.loaded / e.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Upload failed"));
          }
        } catch {
          resolve();
        }
      } else {
        let errorMessage = `Upload failed with status ${xhr.status}`;
        try {
          const responseText = xhr.responseText;
          if (responseText) {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch {
          // Use default message
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    const formData = new FormData();
    const fileExtension = "webm";
    const uploadFileName = fileName 
      ? `${fileName.replace(/[^a-zA-Z0-9\s\-_]/g, '_').replace(/\s+/g, '_')}.${fileExtension}`
      : `video.${fileExtension}`;
    formData.append("file", chunk, uploadFileName);
    formData.append("uploadURL", uploadURL);

    xhr.open("POST", "/api/stream/upload");
    xhr.send(formData);
  });
};

export default function StreamRecorder({
  onRecordingComplete,
}: StreamRecorderProps) {
  const [mode, setMode] = useState<'buffered' | 'live'>('buffered');
  
  // Buffered mode state
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  
  // Live mode state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveInputId, setLiveInputId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [isPausingResuming, setIsPausingResuming] = useState(false);
  
  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const whipClientRef = useRef<WHIPClient | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setProgress(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const options: MediaRecorderOptions = {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000,
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (recorderRef.current && recorderRef.current.state === "inactive") {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await uploadRecording();
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      console.error("Error starting recording:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.requestData();
      recorderRef.current.stop();
      setIsRecording(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStreaming = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);
      setConnectionStatus('connecting');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const generateUniqueStreamName = (): string => {
        if (videoName && videoName.trim()) {
          const now = new Date();
          const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 15);
          const formattedTime = `${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}`;
          const randomStr = Math.random().toString(36).substring(2, 6);
          return `${videoName.trim()} - ${formattedTime}-${randomStr}`;
        }
        return `Live Stream ${new Date().toLocaleString()}`;
      };

      const response = await fetch("/api/stream/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "live",
          meta: { name: generateUniqueStreamName() },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create live input");
      }

      const liveInput = result.data;
      const webRTCUrl = liveInput.webRTC?.url;

      if (!webRTCUrl) {
        throw new Error("WebRTC URL not found in live input response");
      }

      setLiveInputId(liveInput.uid);

      const whipClient = new WHIPClient({
        endpoint: webRTCUrl,
        opts: { debug: false },
      });
      whipClientRef.current = whipClient;

      await whipClient.ingest(stream);
      
      setIsStreaming(true);
      setIsConnecting(false);
      setConnectionStatus('connected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start streaming";
      setError(errorMessage);
      setIsConnecting(false);
      setConnectionStatus('error');
      console.error("Error starting streaming:", err);
      
      if (whipClientRef.current) {
        whipClientRef.current.destroy().catch(() => {});
        whipClientRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [videoName]);

  const pauseResumeStreaming = useCallback(async (pause: boolean) => {
    if (!liveInputId) {
      setError("No live input ID available");
      return;
    }

    try {
      setIsPausingResuming(true);
      setError(null);

      if (pause) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        
        setIsStreaming(false);
        setConnectionStatus('disconnected');
        setIsPaused(true);
        
        const response = await fetch(`/api/live-inputs/${liveInputId}/pause`, {
          method: "POST",
        });
        await response.json();
      } else {
        const response = await fetch(`/api/live-inputs/${liveInputId}/resume`, {
          method: "POST",
        });
        const data = await response.json();

        if (data.success) {
          setIsPaused(false);
        } else {
          setError(data.error || "Failed to resume live input");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${pause ? 'pause' : 'resume'} live input`);
    } finally {
      setIsPausingResuming(false);
    }
  }, [liveInputId]);

  const stopStreaming = useCallback(async () => {
    try {
      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Destroy WHIP client gracefully
      if (whipClientRef.current) {
        try {
          await whipClientRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        whipClientRef.current = null;
      }

      // Clear references
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setIsStreaming(false);
      setConnectionStatus('disconnected');
    } catch (err) {
      console.error("Error stopping stream:", err);
      setError(err instanceof Error ? err.message : "Failed to stop streaming");
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isStreaming && whipClientRef.current) {
        whipClientRef.current.destroy().catch(() => {});
      }
    };
  }, [isStreaming]);

  const uploadRecording = async () => {
    try {
      setIsUploading(true);
      setProgress(0);

      const generateUniqueVideoName = (): string => {
        if (videoName && videoName.trim()) {
          const now = new Date();
          const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 15);
          const formattedTime = `${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}`;
          const randomStr = Math.random().toString(36).substring(2, 6);
          return `${videoName.trim()} - ${formattedTime}-${randomStr}`;
        }
        return `Recording ${new Date().toLocaleString()}`;
      };

      const uniqueVideoName = generateUniqueVideoName();

      const response = await fetch("/api/stream/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          meta: { name: uniqueVideoName },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get upload URL");
      }

      const { uploadURL, uid } = result.data;

      if (!uploadURL) {
        throw new Error("Failed to get upload URL");
      }

      setVideoId(uid);

      const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });

      if (videoBlob.size === 0) {
        throw new Error("No video data recorded. Please record a video before uploading.");
      }

      await uploadVideoChunk(uploadURL, videoBlob, uniqueVideoName, (progress) => {
        setProgress(progress);
      });

      // Check for processing errors
      try {
        const statusResponse = await fetch(`/api/stream/status?videoId=${uid}`);
        const statusResult = await statusResponse.json();
        
        if (statusResult.success && statusResult.data?.status?.state === "error") {
          const errorCode = statusResult.data.status.errReasonCode || "UNKNOWN";
          const errorText = statusResult.data.status.errReasonText || "Unknown error";
          throw new Error(`Video processing failed: ${errorCode} - ${errorText}`);
        }
      } catch {
        // Ignore status check errors
      }

      setProgress(100);
      chunksRef.current = [];

      pollVideoReadinessAndGenerateCaptions(uid);

      if (onRecordingComplete) {
        onRecordingComplete(uid);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload video";
      setError(errorMessage);
      console.error("Error uploading recording:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Mode Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Recording Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="buffered"
              checked={mode === 'buffered'}
              onChange={() => {
                setMode('buffered');
                setError(null);
                if (isStreaming) stopStreaming();
                if (isRecording) stopRecording();
              }}
              disabled={isRecording || isUploading || isStreaming || isConnecting}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Record & Upload</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="live"
              checked={mode === 'live'}
              onChange={() => {
                setMode('live');
                setError(null);
                if (isStreaming) stopStreaming();
                if (isRecording) stopRecording();
              }}
              disabled={isRecording || isUploading || isStreaming || isConnecting}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Live Stream</span>
          </label>
        </div>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
        {!streamRef.current && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center space-y-2">
              <Video className="w-16 h-16 mx-auto opacity-50" />
              <p className="text-lg">Camera preview will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Video/Stream Name Input */}
      <div className="space-y-2">
        <label htmlFor="video-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {mode === 'live' ? 'Stream Name (optional)' : 'Video Name (optional)'}
        </label>
        <input
          id="video-name"
          type="text"
          value={videoName}
          onChange={(e) => setVideoName(e.target.value)}
          placeholder={mode === 'live' ? 'Enter a name for your stream' : 'Enter a name for your video'}
          disabled={isRecording || isUploading || isStreaming || isConnecting}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Buffered Mode Controls */}
      {mode === 'buffered' && (
        <>
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isUploading}
              >
                <Video className="w-5 h-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                disabled={isUploading}
              >
                <Square className="w-5 h-5 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          {isRecording && (
            <div className="flex items-center justify-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <span className="font-medium">Recording...</span>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Upload className="w-5 h-5 animate-pulse" />
                <span className="font-medium">Uploading video... {Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {videoId && !isUploading && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
              <p className="font-medium">Video uploaded successfully!</p>
              <p className="text-sm mt-1">Video ID: {videoId}</p>
            </div>
          )}
        </>
      )}

      {/* Live Mode Controls */}
      {mode === 'live' && (
        <>
          <div className="flex items-center justify-center gap-4">
            {!isStreaming ? (
              <Button
                onClick={startStreaming}
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isConnecting}
              >
                <Video className="w-5 h-5 mr-2" />
                {isConnecting ? 'Connecting...' : 'Start Streaming'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => pauseResumeStreaming(!isPaused)}
                  size="lg"
                  variant="outline"
                  disabled={isPausingResuming}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                <Button
                  onClick={stopStreaming}
                  size="lg"
                  variant="destructive"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop Streaming
                </Button>
              </>
            )}
          </div>

          {isConnecting && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
              <span className="font-medium">Connecting...</span>
            </div>
          )}

          {isStreaming && connectionStatus === 'connected' && (
            <div className="flex items-center justify-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <span className="font-medium">LIVE</span>
            </div>
          )}

          {liveInputId && isStreaming && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
              <p className="font-medium">Streaming live!</p>
              <p className="text-sm mt-1">Live Input ID: {liveInputId}</p>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
