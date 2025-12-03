"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Video, Upload, Square, AlertCircle } from "lucide-react";
import { createDirectUpload, uploadVideoChunk } from "@/lib/cloudflare";

interface StreamRecorderProps {
  onRecordingComplete?: (videoId: string) => void;
}

export default function StreamRecorder({
  onRecordingComplete,
}: StreamRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

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
        }
      };

      recorder.onstop = async () => {
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

      // Create direct upload URL
      const uploadData = await createDirectUpload();
      const { uploadURL, uid } = uploadData;

      if (!uploadURL) {
        throw new Error("Failed to get upload URL");
      }

      setVideoId(uid);

      // Combine all chunks into a single blob
      const videoBlob = new Blob(chunksRef.current, {
        type: "video/webm",
      });

      // Upload the video
      await uploadVideoChunk(uploadURL, videoBlob, (progress) => {
        setProgress(progress);
      });

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

