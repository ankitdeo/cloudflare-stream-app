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
  webRTC?: {
    url: string;
  };
  webRTCPlayback?: {
    url: string;
  };
  recording?: {
    mode?: string;
    requireSignedURLs?: boolean;
    allowedOrigins?: string[] | null;
    hideLiveViewerCount?: boolean;
  };
}

export interface StreamStatus {
  state?: 'ready' | 'live' | 'disconnected';
  errorReasonCode?: string;
  errorReasonText?: string;
  current?: {
    ingestProtocol?: string;
    state?: 'ready' | 'live' | 'disconnected' | 'connected';
    statusEnteredAt?: string;
    statusLastSeen?: string;
  };
  history?: Array<{
    ingestProtocol?: string;
    state?: 'ready' | 'live' | 'disconnected' | 'connected';
    statusEnteredAt?: string;
  }>;
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
    whep?: string; // WHEP playback URL
  };
  isLive?: boolean; // Indicates if this is a live stream
  liveInputId?: string; // Live input UID if this is a live stream
  isLiveRecording?: boolean; // Indicates if this is a recorded video from a live stream
  paused?: boolean; // Indicates if the live input is paused
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
  mode?: 'buffered' | 'live'; // Recording mode
}

export interface EmbedSettings {
  autoplay: boolean;
  loop: boolean;
  preload: "auto" | "metadata" | "none";
  muted: boolean;
}

// Live streaming state
export interface LiveStreamState {
  isStreaming: boolean;
  isConnecting: boolean;
  liveInputId: string | null;
  whipClient: any | null; // WHIP client instance
  stream: MediaStream | null;
  error: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

// DVR (Digital Video Recorder) state
export interface DVRState {
  isLive: boolean; // Whether at live edge
  timeOffset: number; // Seconds behind live (0 when at live edge)
  bufferStart: number; // Earliest available buffer time (timestamp)
  bufferEnd: number; // Latest available buffer time (live edge timestamp)
  currentPosition: number; // Current playback position (timestamp)
  isPaused: boolean;
  canSeek: boolean; // Whether seeking is available
}

