import { StreamInput, Video, UploadResponse } from "@/types/stream";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.warn(
    "Warning: Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
  );
}

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
  
  // If no content or empty body, return empty object/void
  if (response.status === 204 || contentLength === "0" || !contentType?.includes("application/json")) {
    return {} as T;
  }

  // Try to parse JSON, but handle empty responses gracefully
  const text = await response.text();
  if (!text || text.trim() === "") {
    return {} as T;
  }

  try {
    const data = JSON.parse(text);
    return data.result || data;
  } catch (e) {
    // If JSON parsing fails but status is OK, return empty object
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
      maxDurationSeconds: 60, // 1 minute max
      allowedOrigins: ["*"],
      requireSignedURLs: true,
      meta: meta || {},
    }),
  });
}

// Create a live input for streaming
export async function createLiveInput(meta?: { name?: string }): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>("/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: meta || {},
    }),
  });
}

// Get live input status
export async function getLiveInputStatus(inputId: string): Promise<StreamInput> {
  return cloudflareRequest<StreamInput>(`/live_inputs/${inputId}`);
}

// Get video details
export async function getVideo(videoId: string): Promise<Video> {
  return cloudflareRequest<Video>(`/${videoId}`);
}

// List videos
// Cloudflare API returns: { result: Video[], success: boolean, ... }
// The cloudflareRequest function extracts data.result || data
// So we get the array directly
export async function listVideos(): Promise<Video[]> {
  const videos = await cloudflareRequest<Video[]>("/");
  
  // Ensure we return an array
  if (Array.isArray(videos)) {
    return videos;
  }
  
  // Fallback if structure is different
  console.warn("Unexpected video list response format:", videos);
  return [];
}

// Delete video
export async function deleteVideo(videoId: string): Promise<void> {
  await cloudflareRequest<void>(`/${videoId}`, {
    method: "DELETE",
  });
}

// Generate captions for a video using AI
// Language should be in BCP 47 format (e.g., "en" for English)
export async function generateCaptions(videoId: string, language: string = "en"): Promise<void> {
  await cloudflareRequest<void>(`/${videoId}/captions/${language}/generate`, {
    method: "POST",
  });
}

// Generate a signed token for video playback
// Returns a token that can be used in playback URLs instead of the video UID
// Format: https://customer-{CODE}.cloudflarestream.com/{TOKEN}/iframe
export async function generateSignedToken(videoId: string): Promise<string> {
  const response = await cloudflareRequest<{ token: string }>(`/${videoId}/token`, {
    method: "POST",
  });
  
  // The response should contain a token field
  if (response && typeof response === 'object' && 'token' in response) {
    return response.token;
  }
  
  // Fallback: if response is just a string token
  if (typeof response === 'string') {
    return response;
  }
  
  // If structure is different, try to extract token from result
  const result = response as any;
  if (result?.token) {
    return result.token;
  }
  
  throw new Error("Failed to extract token from Cloudflare response");
}

// Update an existing video to require signed URLs
// This is useful for migrating existing videos to use secure playback
export async function updateVideoToRequireSignedURLs(videoId: string): Promise<Video> {
  return cloudflareRequest<Video>(`/${videoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      requireSignedURLs: true,
    }),
  });
}

// Upload video chunk to direct upload URL (server-side version using fetch)
// According to Cloudflare docs: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
// Basic uploads must use POST with multipart/form-data and field name "file"
export async function uploadVideoChunk(
  uploadURL: string,
  chunk: Blob | ArrayBuffer | File,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    // Convert to File or Blob for FormData
    let file: File | Blob;
    if (chunk instanceof File) {
      file = chunk;
    } else if (chunk instanceof Blob) {
      // Convert Blob to File-like object for FormData
      file = new File([chunk], "video.webm", { type: chunk.type || "video/webm" });
    } else {
      // ArrayBuffer - convert to File
      file = new File([chunk], "video.webm", { type: "video/webm" });
    }
    
    console.log("Uploading to Cloudflare:", {
      url: uploadURL.substring(0, 100) + "...",
      size: file.size,
      type: file.type,
    });
    
    // Create FormData with field name "file" as per Cloudflare documentation
    const formData = new FormData();
    formData.append("file", file);
    
    // Cloudflare Stream requires POST with multipart/form-data
    // Field name must be "file" (as shown in docs: --form file=@...)
    const response = await fetch(uploadURL, {
      method: "POST",
      body: formData,
      // Don't set Content-Type header - browser/Node will set it with boundary
    });

    console.log("Cloudflare response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare upload error:", errorText);
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.errors?.[0]?.message || errorData.message || errorMessage;
      } catch (e) {
        // If parsing fails, include the raw error text
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
        }
      }
      throw new Error(errorMessage);
    }
    
    console.log("Upload successful");
  } catch (error) {
    console.error("Upload error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Upload failed");
  }
}

