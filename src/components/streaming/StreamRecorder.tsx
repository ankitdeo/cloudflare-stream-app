"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Video, Upload, Square, AlertCircle } from "lucide-react";

interface StreamRecorderProps {
  onRecordingComplete?: (videoId: string) => void;
}

// Helper function for uploading video through our API route (avoids CORS)
const uploadVideoChunk = (
  uploadURL: string,
  chunk: Blob,
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
        } catch (e) {
          // If response is not JSON, assume success for 2xx status
          resolve();
        }
      } else {
        // Try to get error message from response
        let errorMessage = `Upload failed with status ${xhr.status}`;
        try {
          const responseText = xhr.responseText;
          if (responseText) {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch (e) {
          // If parsing fails, use default message
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

    // Upload through our API route to avoid CORS
    const formData = new FormData();
    formData.append("file", chunk, "video.webm");
    formData.append("uploadURL", uploadURL);

    xhr.open("POST", "/api/stream/upload");
    xhr.send(formData);
  });
};

export default function StreamRecorder({
  onRecordingComplete,
}: StreamRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setProgress(0);

      // Request media access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;

      // Display stream in video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: "video/webm;codecs=vp9,opus",
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      // Fallback to default if VP9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log("Chunk received:", event.data.size, "bytes. Total chunks:", chunksRef.current.length);
        }
      };

      recorder.onstop = async () => {
        // Request any remaining data
        if (recorderRef.current && recorderRef.current.state === "inactive") {
          // Small delay to ensure all data is collected
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Upload the recorded video
        await uploadRecording();
      };

      recorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      console.error("Error starting recording:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      // Request final data chunk before stopping
      recorderRef.current.requestData();
      recorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const uploadRecording = async () => {
    try {
      setIsUploading(true);
      setProgress(0);

      // Call API route to get upload URL (server-side, can access env variables)
      const response = await fetch("/api/stream/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "direct",
          meta: {
            name: videoName || `Recording ${new Date().toLocaleString()}`,
          },
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

      // Combine all chunks into a single blob
      const videoBlob = new Blob(chunksRef.current, {
        type: "video/webm",
      });

      // Check if video blob is empty
      if (videoBlob.size === 0) {
        throw new Error("No video data recorded. Please record a video before uploading.");
      }

      console.log("Uploading video:", {
        size: videoBlob.size,
        type: videoBlob.type,
        chunks: chunksRef.current.length,
        uploadURL: uploadURL.substring(0, 50) + "...",
      });

      // Upload the video
      await uploadVideoChunk(uploadURL, videoBlob, (progress) => {
        setProgress(progress);
      });

      console.log("Upload completed successfully");

      // Check video status after upload
      try {
        const statusResponse = await fetch(`/api/stream/status?videoId=${uid}`);
        const statusResult = await statusResponse.json();
        
        if (statusResult.success && statusResult.data) {
          const video = statusResult.data;
          console.log("Video status:", video.status);
          
          if (video.status?.state === "error") {
            const errorCode = video.status.errReasonCode || "UNKNOWN";
            const errorText = video.status.errReasonText || "Unknown error";
            throw new Error(`Video processing failed: ${errorCode} - ${errorText}`);
          }
        }
      } catch (statusErr) {
        // Don't fail the upload if status check fails, just log it
        console.warn("Could not check video status:", statusErr);
      }

      setProgress(100);
      chunksRef.current = [];

      if (onRecordingComplete) {
        onRecordingComplete(uid);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to upload video";
      setError(errorMessage);
      console.error("Error uploading recording:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
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

      {/* Video Name Input */}
      <div className="space-y-2">
        <label htmlFor="video-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Video Name (optional)
        </label>
        <input
          id="video-name"
          type="text"
          value={videoName}
          onChange={(e) => setVideoName(e.target.value)}
          placeholder="Enter a name for your video"
          disabled={isRecording || isUploading}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white"
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

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {videoId && !isUploading && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
          <p className="font-medium">Video uploaded successfully!</p>
          <p className="text-sm mt-1">Video ID: {videoId}</p>
        </div>
      )}
    </div>
  );
}

