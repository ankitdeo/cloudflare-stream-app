import { StreamInput, Video, UploadResponse } from "@/types/stream";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

async function cloudflareRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error("Cloudflare credentials not configured");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ errors: [] }));
    throw new Error(
      error.errors?.[0]?.message || `HTTP error! status: ${response.status}`
    );
  }

  // Handle empty responses (e.g., DELETE requests with 204 No Content)
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  
  if (response.status === 204 || contentLength === "0" || !contentType?.includes("application/json")) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return {} as T;
  }

  try {
    const data = JSON.parse(text);
    return data.result || data;
  } catch (e) {
    if (response.ok) {
      return {} as T;
    }
    throw new Error(`Failed to parse response: ${text.substring(0, 100)}`);
  }
}

// Create a direct creator upload URL
export async function createDirectUpload(meta?: { name?: string }): Promise<UploadResponse> {
  return cloudflareRequest<UploadResponse>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: 60,
      allowedOrigins: ["*"],
      requireSignedURLs: true,
      meta: meta || {},
    }),
  });
}

// Create a live input for streaming with automatic recording
export async function createLiveInput(meta?: { name?: string }): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>("/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: meta || {},
      recording: {
        mode: "automatic",
        requireSignedURLs: false,
        allowedOrigins: null,
        hideLiveViewerCount: false,
      },
    }),
  });
}

// Get recorded videos from a live input
export async function getLiveInputRecordings(inputId: string): Promise<Video[]> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${inputId}/videos`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const errorText = await response.text();
      throw new Error(`Failed to fetch recordings: ${response.status} ${errorText}`);
    }
    
    const rawData = await response.json();
    const videos = rawData.result || rawData;
    
    return Array.isArray(videos) ? videos : [];
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return [];
  }
}

// List all live inputs
export async function listLiveInputs(): Promise<StreamInput[]> {
  const liveInputs = await cloudflareRequest<StreamInput[]>("/live_inputs");
  return Array.isArray(liveInputs) ? liveInputs : [];
}

// Get live input status
export async function getLiveInputStatus(inputId: string): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>(`/live_inputs/${inputId}`);
}

// Update live input to enable automatic recording
export async function updateLiveInputRecording(inputId: string, enable: boolean = true): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>(`/live_inputs/${inputId}`, {
    method: "PUT",
    body: JSON.stringify({
      recording: {
        mode: enable ? "automatic" : "manual",
      },
    }),
  });
}

// Pause a live input
export async function pauseLiveInput(inputId: string): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>(`/live_inputs/${inputId}`, {
    method: "PUT",
    body: JSON.stringify({
      paused: true,
    }),
  });
}

// Resume a live input
export async function resumeLiveInput(inputId: string): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>(`/live_inputs/${inputId}`, {
    method: "PUT",
    body: JSON.stringify({
      paused: false,
    }),
  });
}

// Get WHIP URL from live input
export async function getLiveInputWebRTCUrl(inputId: string): Promise<string> {
  const liveInput = await getLiveInputStatus(inputId);
  if (liveInput.webRTC?.url) {
    return liveInput.webRTC.url;
  }
  throw new Error("WebRTC URL not found in live input response");
}

// Get WHEP playback URL from live input
export async function getLiveInputWebRTCPlaybackUrl(inputId: string): Promise<string> {
  const liveInput = await getLiveInputStatus(inputId);
  if (liveInput.webRTCPlayback?.url) {
    return liveInput.webRTCPlayback.url;
  }
  throw new Error("WebRTC playback URL not found in live input response");
}

// Get video details
export async function getVideo(videoId: string): Promise<Video> {
  return cloudflareRequest<Video>(`/${videoId}`);
}

// List videos
export async function listVideos(): Promise<Video[]> {
  const videos = await cloudflareRequest<Video[]>("/");
  return Array.isArray(videos) ? videos : [];
}

// Delete video
export async function deleteVideo(videoId: string): Promise<void> {
  await cloudflareRequest<void>(`/${videoId}`, {
    method: "DELETE",
  });
}

// Delete live input
export async function deleteLiveInput(inputId: string): Promise<void> {
  await cloudflareRequest<void>(`/live_inputs/${inputId}`, {
    method: "DELETE",
  });
}

// Generate captions for a video using AI
export async function generateCaptions(videoId: string, language: string = "en"): Promise<void> {
  await cloudflareRequest<void>(`/${videoId}/captions/${language}/generate`, {
    method: "POST",
  });
}

// Generate a signed token for video playback
export async function generateSignedToken(videoId: string): Promise<string> {
  const response = await cloudflareRequest<{ token: string }>(`/${videoId}/token`, {
    method: "POST",
  });
  
  if (response && typeof response === 'object' && 'token' in response) {
    return response.token;
  }
  
  if (typeof response === 'string') {
    return response;
  }
  
  const result = response as any;
  if (result?.token) {
    return result.token;
  }
  
  throw new Error("Failed to extract token from Cloudflare response");
}

// Update an existing video to require signed URLs
export async function updateVideoToRequireSignedURLs(videoId: string): Promise<Video> {
  return cloudflareRequest<Video>(`/${videoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      requireSignedURLs: true,
    }),
  });
}

// Upload video chunk to direct upload URL
export async function uploadVideoChunk(
  uploadURL: string,
  chunk: Blob | ArrayBuffer | File,
  onProgress?: (progress: number) => void
): Promise<void> {
  let file: File | Blob;
  if (chunk instanceof File) {
    file = chunk;
  } else if (chunk instanceof Blob) {
    file = new File([chunk], "video.webm", { type: chunk.type || "video/webm" });
  } else {
    file = new File([chunk], "video.webm", { type: "video/webm" });
  }
  
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(uploadURL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Upload failed with status ${response.status}`;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.errors?.[0]?.message || errorData.message || errorMessage;
    } catch (e) {
      if (errorText) {
        errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
      }
    }
    throw new Error(errorMessage);
  }
}
