export interface StreamInput {
  uid?: string;
  url?: string;
  status?: StreamStatus;
  created?: string;
  modified?: string;
  paused?: boolean;
  meta?: {
    name?: string;
  };
}

export interface StreamStatus {
  state: 'ready' | 'live' | 'disconnected';
  errorReasonCode?: string;
  errorReasonText?: string;
}

export interface Video {
  uid: string;
  thumbnail?: string;
  readyToStream?: boolean;
  status?: {
    state: 'pendingupload' | 'downloading' | 'queued' | 'ready' | 'error';
  };
  meta?: {
    name?: string;
  };
  created?: string;
  modified?: string;
  duration?: number;
  playback?: {
    iframe?: string;
    hls?: string;
    dash?: string;
  };
}

export interface UploadResponse {
  uid: string;
  uploadURL?: string;
  thumbnail?: string;
  readyToStream?: boolean;
  status?: {
    state: string;
  };
}

export interface StreamRecorderState {
  isRecording: boolean;
  isUploading: boolean;
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  videoId: string | null;
  error: string | null;
  progress: number;
}

export interface EmbedSettings {
  autoplay: boolean;
  loop: boolean;
  preload: "auto" | "metadata" | "none";
  muted: boolean;
}

