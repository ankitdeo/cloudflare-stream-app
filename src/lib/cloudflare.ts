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

  const data = await response.json();
  return data.result || data;
}

// Create a direct creator upload URL
export async function createDirectUpload(): Promise<UploadResponse> {
  return cloudflareRequest<UploadResponse>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: 3600, // 1 hour max
      allowedOrigins: ["*"],
      requireSignedURLs: false,
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
export async function listVideos(): Promise<Video[]> {
  const response = await cloudflareRequest<{ videos: Video[] }>("/");
  return response.videos || [];
}

// Upload video chunk to direct upload URL
export async function uploadVideoChunk(
  uploadURL: string,
  chunk: Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
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
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.open("PUT", uploadURL);
    xhr.send(chunk);
  });
}

